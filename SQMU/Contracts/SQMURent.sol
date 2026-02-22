// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ERC1155HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface ISQMURentDistribution {
    function depositRent(uint256 propertyId, address token, uint256 amount) external;
}

/// @title SQMU Rent Manager
/// @notice Collects deposits and rent for properties, forwarding net rent to the distribution vault.
/// @dev Upgradeable via UUPS and capable of holding ERC-20 stablecoins and ERC-1155 tokens.
contract SQMURent is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Deposit {
        uint256 amount;
        address token;
    }

    struct RentalInfo {
        address tenant;
        uint256 nextRentDue;
        bool occupied;
    }

    /// @notice Deposit per property for the active tenant.
    mapping(uint256 => Deposit) public deposits;
    /// @notice Rental details per property.
    mapping(uint256 => RentalInfo) public rentals;

    uint256 public constant RENT_PERIOD = 30 days;
    uint256 public constant RENT_WINDOW = 7 days;
    /// @notice Allowed ERC-20 stablecoins.
    mapping(address => bool) public acceptedTokens;

    uint256 public managementFee; // basis points (1000 = 10%)
    address public treasury;
    ISQMURentDistribution public vault;

    event DepositPaid(uint256 indexed propertyId, address indexed tenant, address token, uint256 amount);
    event DepositRefunded(
        uint256 indexed propertyId,
        address indexed tenant,
        address token,
        uint256 refundAmount,
        uint256 remainder
    );
    event RentCollected(uint256 indexed propertyId, address indexed tenant, address token, uint256 amount, uint256 fee);
    event ManagementFeesWithdrawn(address indexed token, uint256 amount);
    event TokenAccepted(address token, bool status);
    event TreasurySet(address treasury);
    event ManagementFeeSet(uint256 fee);
    event VaultSet(address vault);
    event NFTDeposited(address indexed from, address token, uint256 id, uint256 amount);
    event NFTWithdrawn(address indexed to, address token, uint256 id, uint256 amount);
    event PropertyOccupied(uint256 indexed propertyId, address indexed tenant, uint256 nextRentDue);
    event PropertyVacated(uint256 indexed propertyId, address indexed tenant);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize contract with the distribution vault address.
    function initialize(address vaultAddress) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        vault = ISQMURentDistribution(vaultAddress);
        managementFee = 1000;
    }

    function _authorizeUpgrade(address newImpl) internal override onlyOwner {}

    /// ------------------------------------------------------------
    /// Admin functions
    /// ------------------------------------------------------------

    /// @notice Allow or disallow an ERC-20 stablecoin.
    function setAcceptedToken(address token, bool status) external onlyOwner {
        acceptedTokens[token] = status;
        emit TokenAccepted(token, status);
    }

    /// @notice Set the treasury address for management fees.
    function setTreasury(address wallet) external onlyOwner {
        treasury = wallet;
        emit TreasurySet(wallet);
    }

    /// @notice Update the management fee in basis points.
    function setManagementFee(uint256 fee) external onlyOwner {
        managementFee = fee;
        emit ManagementFeeSet(fee);
    }

    /// @notice Update the rent distribution vault address.
    function setVault(address vaultAddress) external onlyOwner {
        vault = ISQMURentDistribution(vaultAddress);
        emit VaultSet(vaultAddress);
    }

    /// ------------------------------------------------------------
    /// Deposit and rent logic
    /// ------------------------------------------------------------

    /// @notice Tenant pays a refundable deposit in an accepted stablecoin.
    function payDeposit(uint256 propertyId, address token, uint256 amount) external nonReentrant {
        require(acceptedTokens[token], "Token not accepted");
        RentalInfo storage info = rentals[propertyId];
        require(!info.occupied, "Property occupied");

        deposits[propertyId] = Deposit(amount, token);
        rentals[propertyId] = RentalInfo({
            tenant: msg.sender,
            nextRentDue: block.timestamp + RENT_PERIOD,
            occupied: true
        });

        IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);
        emit DepositPaid(propertyId, msg.sender, token, amount);
        emit PropertyOccupied(propertyId, msg.sender, block.timestamp + RENT_PERIOD);
    }

    /// @notice View the deposit details for a property including current contract balance.
    function getDepositDetails(uint256 propertyId)
        public
        view
        returns (uint256 amount, address token, address tenant, uint256 contractBalance)
    {
        Deposit memory dep = deposits[propertyId];
        RentalInfo memory info = rentals[propertyId];
        amount = dep.amount;
        token = dep.token;
        tenant = info.tenant;
        contractBalance = token != address(0) ? IERC20Upgradeable(token).balanceOf(address(this)) : 0;
    }

    /// @notice Owner refunds a tenant deposit. Remaining balance is sent to the treasury.
    function refundDeposit(uint256 propertyId, address tenant, uint256 refundAmount)
        external
        onlyOwner
        nonReentrant
    {
        RentalInfo storage info = rentals[propertyId];
        require(info.occupied && info.tenant == tenant, "Not tenant");

        Deposit storage dep = deposits[propertyId];
        require(dep.amount > 0, "No deposit");
        require(refundAmount <= dep.amount, "Over refund");

        uint256 remainder = dep.amount - refundAmount;
        address token = dep.token;

        delete deposits[propertyId];
        delete rentals[propertyId];

        if (refundAmount > 0) {
            IERC20Upgradeable(token).safeTransfer(tenant, refundAmount);
        }
        if (remainder > 0) {
            IERC20Upgradeable(token).safeTransfer(treasury, remainder);
        }
        emit DepositRefunded(propertyId, tenant, token, refundAmount, remainder);
        emit PropertyVacated(propertyId, tenant);
    }

    /// @notice Collect rent from a tenant and forward the net amount to the vault.
    function collectRent(uint256 propertyId, address token, uint256 amount) external nonReentrant {
        require(acceptedTokens[token], "Token not accepted");
        RentalInfo storage info = rentals[propertyId];
        require(info.occupied && info.tenant == msg.sender, "Not tenant");
        require(
            block.timestamp >= info.nextRentDue - RENT_WINDOW &&
                block.timestamp <= info.nextRentDue + RENT_WINDOW,
            "Outside window"
        );

        IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * managementFee) / 10000;
        uint256 net = amount - fee;

        IERC20Upgradeable(token).safeApprove(address(vault), net);
        vault.depositRent(propertyId, token, net);

        info.nextRentDue += RENT_PERIOD;

        emit RentCollected(propertyId, msg.sender, token, amount, fee);
    }

    /// @notice Withdraw accumulated management fees to the treasury.
    function withdrawManagementFees(address token) external onlyOwner nonReentrant {
        uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
        IERC20Upgradeable(token).safeTransfer(treasury, balance);
        emit ManagementFeesWithdrawn(token, balance);
    }

    /// ------------------------------------------------------------
    /// ERC-1155 handling
    /// ------------------------------------------------------------

    /// @notice Deposit an ERC-1155 token into the contract.
    function depositNFT(address token, uint256 id, uint256 amount, bytes calldata data) external {
        IERC1155(token).safeTransferFrom(msg.sender, address(this), id, amount, data);
        emit NFTDeposited(msg.sender, token, id, amount);
    }

    /// @notice Owner can withdraw ERC-1155 tokens held by this contract.
    function withdrawNFT(address token, uint256 id, uint256 amount, address to) external onlyOwner {
        IERC1155(token).safeTransferFrom(address(this), to, id, amount, "");
        emit NFTWithdrawn(to, token, id, amount);
    }
}

