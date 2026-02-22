// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ERC1155HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {IERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

/// @title SQMU Rent Distribution Vault
/// @notice Holds rent per property and distributes funds on demand.
/// @dev Upgradeable via UUPS and capable of holding ERC-20 stablecoins and ERC-1155 tokens.
contract SQMURentDistribution is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice propertyId => token => balance
    mapping(uint256 => mapping(address => uint256)) public rentBalances;

    event RentDeposited(uint256 indexed propertyId, address indexed token, uint256 amount);
    event RentDistributed(uint256 indexed propertyId, address indexed token, uint256 total);
    event NFTDeposited(address indexed from, address token, uint256 id, uint256 amount);
    event NFTWithdrawn(address indexed to, address token, uint256 id, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImpl) internal override onlyOwner {}

    /// ------------------------------------------------------------
    /// Rent handling
    /// ------------------------------------------------------------

    /// @notice Deposit rent for a property using an accepted stablecoin.
    function depositRent(uint256 propertyId, address token, uint256 amount) external nonReentrant {
        IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);
        rentBalances[propertyId][token] += amount;
        emit RentDeposited(propertyId, token, amount);
    }

    /// @notice Distribute rent to holders. Caller enumerates recipients and amounts.
    function distribute(
        uint256 propertyId,
        address token,
        address[] calldata holders,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(holders.length == amounts.length, "Length mismatch");
        uint256 totalAmount = rentBalances[propertyId][token];
        uint256 sum;
        for (uint256 i = 0; i < amounts.length; i++) {
            sum += amounts[i];
        }
        require(sum <= totalAmount, "Exceeds balance");
        rentBalances[propertyId][token] -= sum;
        for (uint256 i = 0; i < holders.length; i++) {
            IERC20Upgradeable(token).safeTransfer(holders[i], amounts[i]);
        }
        emit RentDistributed(propertyId, token, sum);
    }

    /// ------------------------------------------------------------
    /// ERC-1155 handling
    /// ------------------------------------------------------------

    /// @notice Deposit an ERC-1155 token into the vault.
    function depositNFT(address token, uint256 id, uint256 amount, bytes calldata data) external {
        IERC1155Upgradeable(token).safeTransferFrom(msg.sender, address(this), id, amount, data);
        emit NFTDeposited(msg.sender, token, id, amount);
    }

    /// @notice Owner can withdraw ERC-1155 tokens held by the vault.
    function withdrawNFT(address token, uint256 id, uint256 amount, address to) external onlyOwner {
        IERC1155Upgradeable(token).safeTransferFrom(address(this), to, id, amount, "");
        emit NFTWithdrawn(to, token, id, amount);
    }
}

