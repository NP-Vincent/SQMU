// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {Escrow} from "./Escrow.sol";

/// @title SQMU Escrow Factory
/// @notice UUPS-upgradeable registry and creation point for escrow clones.
contract EscrowFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using Clones for address;

    struct EscrowRecord {
        address buyer;
        address seller;
        address agent;
        address token;
        bytes32 propertyRef;
        uint256 deadline;
    }

    error DuplicateParticipant();
    error InvalidDeadline();
    error InvalidImplementation(address implementation);
    error InvalidPropertyRef();
    error InvalidStageTarget();
    error TokenNotAllowed(address token);
    error ZeroAddress();

    address public escrowImplementation;

    mapping(address => bool) public allowedTokens;
    mapping(address => EscrowRecord) public escrowRecords;

    address[] private _escrows;
    mapping(address => address[]) private _escrowsByParticipant;
    mapping(bytes32 => address[]) private _escrowsByProperty;
    mapping(address => address[]) private _escrowsByToken;

    event AllowedTokenUpdated(address indexed token, bool allowed);
    event EscrowCreated(
        address indexed escrow,
        address indexed buyer,
        address indexed seller,
        address agent,
        address token,
        bytes32 propertyRef,
        uint256 deadline
    );
    event ImplementationChanged(address indexed implementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address implementation, address admin) external initializer {
        if (admin == address(0)) {
            revert ZeroAddress();
        }

        __Ownable_init(admin);
        __Pausable_init();

        _setImplementation(implementation);
    }

    function createEscrow(
        address buyer,
        address seller,
        address agent,
        address token,
        bytes32 propertyRef,
        uint256 deadline,
        uint256 eoiTarget,
        uint256 depositTarget,
        uint256 finalTarget
    ) external whenNotPaused returns (address escrow) {
        if (buyer == address(0) || seller == address(0) || agent == address(0) || token == address(0)) {
            revert ZeroAddress();
        }
        if (buyer == seller || buyer == agent || seller == agent) {
            revert DuplicateParticipant();
        }
        if (propertyRef == bytes32(0)) {
            revert InvalidPropertyRef();
        }
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }
        if (eoiTarget == 0 || depositTarget == 0 || finalTarget == 0) {
            revert InvalidStageTarget();
        }
        if (!allowedTokens[token]) {
            revert TokenNotAllowed(token);
        }

        escrow = escrowImplementation.clone();

        Escrow(escrow).initialize(
            buyer,
            seller,
            agent,
            token,
            propertyRef,
            deadline,
            eoiTarget,
            depositTarget,
            finalTarget
        );

        escrowRecords[escrow] = EscrowRecord({
            buyer: buyer,
            seller: seller,
            agent: agent,
            token: token,
            propertyRef: propertyRef,
            deadline: deadline
        });

        _escrows.push(escrow);
        _escrowsByParticipant[buyer].push(escrow);
        _escrowsByParticipant[seller].push(escrow);
        _escrowsByParticipant[agent].push(escrow);
        _escrowsByProperty[propertyRef].push(escrow);
        _escrowsByToken[token].push(escrow);

        emit EscrowCreated(escrow, buyer, seller, agent, token, propertyRef, deadline);
    }

    function setImplementation(address implementation) external onlyOwner {
        _setImplementation(implementation);
    }

    function addAllowedToken(address token) external onlyOwner {
        if (token == address(0)) {
            revert ZeroAddress();
        }

        allowedTokens[token] = true;
        emit AllowedTokenUpdated(token, true);
    }

    function removeAllowedToken(address token) external onlyOwner {
        if (token == address(0)) {
            revert ZeroAddress();
        }

        allowedTokens[token] = false;
        emit AllowedTokenUpdated(token, false);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getEscrowCount() external view returns (uint256) {
        return _escrows.length;
    }

    function getEscrows() external view returns (address[] memory) {
        return _escrows;
    }

    function getEscrowsByParticipant(address participant) external view returns (address[] memory) {
        return _escrowsByParticipant[participant];
    }

    function getEscrowsByProperty(bytes32 propertyRef) external view returns (address[] memory) {
        return _escrowsByProperty[propertyRef];
    }

    function getEscrowsByToken(address token) external view returns (address[] memory) {
        return _escrowsByToken[token];
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _setImplementation(address implementation) internal {
        if (implementation == address(0) || implementation.code.length == 0) {
            revert InvalidImplementation(implementation);
        }

        escrowImplementation = implementation;
        emit ImplementationChanged(implementation);
    }
}
