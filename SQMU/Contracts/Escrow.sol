// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MultiSignerERC7913Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/signers/MultiSignerERC7913Upgradeable.sol";

interface IEscrowFactory {
    function allowedTokens(address token) external view returns (bool);
}

/// @title Upgradeable Escrow Contract with Minimal Proxy Factory
/// @notice Implements a basic property escrow following the architecture
/// outlined in `escrow_system_technical_architecture.md`.
contract Escrow is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlEnumerableUpgradeable,
    PausableUpgradeable,
    MultiSignerERC7913Upgradeable
{
    using SafeERC20 for IERC20;

    /// @dev States for each escrow lifecycle.
    enum State {
        Created,
        Funded,
        AwaitingDocuments,
        PendingRelease,
        Released,
        Cancelled,
        Expired
    }

    enum DepositStage {
        EOI,
        Initial,
        Balance
    }

    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    bytes32 public constant SELLER_ROLE = keccak256("SELLER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Whitelisted ERC20 stablecoin for payments.
    IERC20 public paymentToken;

    /// @notice Reference to the factory that deployed this escrow.
    address public factory;

    /// @notice Deadline timestamp after which the escrow can expire.
    uint256 public deadline;

    /// @notice Current lifecycle state.
    State public state;

    struct DocumentHash {
        string hash;
        uint256 timestamp;
    }

    /// @notice All document hashes for this escrow (history retained).
    DocumentHash[] public documentHashes;

    /// @dev Tracks deposits per stage.
    mapping(DepositStage => uint256) public depositForStage;

    event Deposited(address indexed from, uint256 amount, DepositStage stage);
    event Released(address indexed to, uint256 amount);
    event Cancelled(address indexed by);
    event Expired(address indexed by);
    event DocumentHashAdded(string hash, uint256 timestamp);
    event StateChanged(State newState);
    event EscrowUpgraded(address newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the escrow with core participants and multisig signers.
    /// @param buyer Buyer wallet.
    /// @param agent Escrow agent wallet.
    /// @param seller Optional seller wallet.
    /// @param token Stablecoin address.
    /// @param deadline_ Expiry timestamp.
    /// @param signers ERC-7913 encoded signers for multisig control.
    function initialize(
        address buyer,
        address agent,
        address seller,
        IERC20 token,
        uint256 deadline_,
        bytes[] calldata signers
    ) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __AccessControlEnumerable_init();
        __Pausable_init();

        factory = msg.sender;
        require(
            IEscrowFactory(msg.sender).allowedTokens(address(token)),
            "token not allowed"
        );
        paymentToken = token;
        deadline = deadline_;
        state = State.Created;

        _grantRole(BUYER_ROLE, buyer);
        _grantRole(AGENT_ROLE, agent);
        if (seller != address(0)) {
            _grantRole(SELLER_ROLE, seller);
        }
        _grantRole(ADMIN_ROLE, agent);

        __MultiSignerERC7913_init(signers, 2);
    }

    // ------------------------------------------------------------
    // Core Escrow Functions
    // ------------------------------------------------------------

    /// @notice Deposit stablecoins into escrow.
    /// @param amount Amount of tokens to deposit.
    /// @param stage Deposit stage (EOI, Initial, Balance).
    function deposit(uint256 amount, DepositStage stage)
        external
        nonReentrant
        onlyRole(BUYER_ROLE)
    {
        require(amount > 0, "amount required");
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        depositForStage[stage] += amount;
        if (state == State.Created) {
            _setState(State.Funded);
        }
        emit Deposited(msg.sender, amount, stage);
    }

    /// @notice Record an off-chain document hash.
    /// @param hash New document hash (e.g., deed or MOU).
    function addDocumentHash(string calldata hash) external onlyRole(AGENT_ROLE) {
        documentHashes.push(DocumentHash(hash, block.timestamp));
        emit DocumentHashAdded(hash, block.timestamp);
        if (state == State.Funded) {
            _setState(State.AwaitingDocuments);
        }
    }

    /// @notice Release funds once multisig signatures are validated.
    /// @param to Recipient of funds (typically seller).
    /// @param amount Amount to release.
    /// @param signature Encoded multi-signature data.
    function release(
        address to,
        uint256 amount,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(state == State.Funded || state == State.AwaitingDocuments || state == State.PendingRelease, "bad state");
        bytes32 hash = keccak256(abi.encodePacked(address(this), to, amount));
        require(_rawSignatureValidation(hash, signature), "invalid sig");

        paymentToken.safeTransfer(to, amount);
        _setState(State.Released);
        emit Released(to, amount);
    }

    /// @notice Cancel the escrow and refund the buyer.
    function cancel() external onlyRole(AGENT_ROLE) whenNotPaused {
        require(state != State.Released && state != State.Cancelled, "finalized");
        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance > 0) {
            paymentToken.safeTransfer(_msgSender(), balance);
        }
        _setState(State.Cancelled);
        emit Cancelled(msg.sender);
    }

    /// @notice Trigger expiry if the deadline has passed.
    function expire() external whenNotPaused {
        require(block.timestamp >= deadline, "not expired");
        require(state != State.Released && state != State.Cancelled, "finalized");
        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance > 0) {
            paymentToken.safeTransfer(_msgSender(), balance);
        }
        _setState(State.Expired);
        emit Expired(msg.sender);
    }

    // ------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        emit EscrowUpgraded(newImplementation);
    }

    function _setState(State newState) internal {
        if (state != newState) {
            state = newState;
            emit StateChanged(newState);
        }
    }
}

/// @title EscrowFactory
/// @notice Deploys minimal proxy clones of {Escrow}.
contract EscrowFactory is Initializable, UUPSUpgradeable, AccessControlEnumerableUpgradeable, PausableUpgradeable {
    using Clones for address;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public escrowImplementation;
    address[] public escrows;
    mapping(address => bool) public allowedTokens;

    event EscrowCreated(address indexed escrow, address buyer, address seller, address agent, IERC20 token, uint256 deadline);
    event ImplementationChanged(address newImplementation);
    event EscrowFactoryUpgraded(address newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address implementation) external initializer {
        __UUPSUpgradeable_init();
        __AccessControlEnumerable_init();
        __Pausable_init();

        escrowImplementation = implementation;
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function createEscrow(
        address buyer,
        address agent,
        address seller,
        IERC20 token,
        uint256 deadline,
        bytes[] calldata signers
    ) external whenNotPaused onlyRole(ADMIN_ROLE) returns (address) {
        require(allowedTokens[address(token)], "token not allowed");
        address clone = escrowImplementation.clone();
        Escrow(payable(clone)).initialize(buyer, agent, seller, token, deadline, signers);
        escrows.push(clone);
        emit EscrowCreated(clone, buyer, seller, agent, token, deadline);
        return clone;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        emit EscrowFactoryUpgraded(newImplementation);
    }

    function setImplementation(address implementation) external onlyRole(ADMIN_ROLE) {
        escrowImplementation = implementation;
        emit ImplementationChanged(implementation);
    }

    function addAllowedToken(address token) external onlyRole(ADMIN_ROLE) {
        allowedTokens[token] = true;
    }

    function removeAllowedToken(address token) external onlyRole(ADMIN_ROLE) {
        allowedTokens[token] = false;
    }

    function getEscrows() external view returns (address[] memory) {
        return escrows;
    }
}
