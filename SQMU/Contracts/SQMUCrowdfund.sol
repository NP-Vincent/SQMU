// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import {ERC1155HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";

/// @title SQMU Crowdfund Contract
/// @notice Sells pre-minted governance tokens (ID 0) for stablecoins held by this contract.
/// @dev Upgradeable via UUPS pattern. Uses Ownable for admin controls and holds ERC-1155 tokens.
contract SQMUCrowdfund is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC1155HolderUpgradeable
{
    /// ---------------------------------------------------------------------
    /// Storage
    /// ---------------------------------------------------------------------

    IERC1155Upgradeable public sqmu;

    /// @dev Accepted stablecoin addresses on Scroll mainnet.
    address public constant USDT = 0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df;
    address public constant USDC = 0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4;
    address public constant USDQ = 0xdb9E8F82D6d45fFf803161F2a5f75543972B229a;

    uint256 public constant GOVERNANCE_ID = 0;
    /// @dev Price per governance token in USD with 18 decimals (1e18 = $1)
    uint256 public priceUSD;

    event GovernancePurchased(address indexed buyer, address token, uint256 amount, uint256 totalPaid);
    event PriceUpdated(uint256 newPriceUSD);
    event PaymentsWithdrawn(address indexed token, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address sqmuAddress, uint256 priceUSD_) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        sqmu = IERC1155Upgradeable(sqmuAddress);
        priceUSD = priceUSD_;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// ---------------------------------------------------------------------
    /// Crowdfund Logic
    /// ---------------------------------------------------------------------

    /// @notice Purchase governance tokens by paying with a supported stablecoin.
    /// @param paymentToken Address of USDC, USDT or USDQ on Scroll.
    /// @param amount Number of governance tokens to buy.
    function buy(address paymentToken, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount required");
        require(
            paymentToken == USDC || paymentToken == USDT || paymentToken == USDQ,
            "Token not allowed"
        );

        IERC20Upgradeable erc20 = IERC20Upgradeable(paymentToken);
        uint8 decimals = IERC20MetadataUpgradeable(paymentToken).decimals();
        uint256 total = (priceUSD * amount * (10 ** decimals)) / 1e18;
        require(total > 0, "Zero price");

        require(erc20.transferFrom(msg.sender, address(this), total), "Payment failed");
        require(
            sqmu.balanceOf(address(this), GOVERNANCE_ID) >= amount,
            "Insufficient supply"
        );

        sqmu.safeTransferFrom(address(this), msg.sender, GOVERNANCE_ID, amount, "");

        emit GovernancePurchased(msg.sender, paymentToken, amount, total);
    }

    /// @notice Update the USD price per governance token.
    function setPriceUSD(uint256 newPriceUSD) external onlyOwner {
        priceUSD = newPriceUSD;
        emit PriceUpdated(newPriceUSD);
    }

    /// @notice Withdraw collected stablecoins to the owner address.
    /// @param token ERC20 stablecoin address.
    /// @param amount Amount to withdraw (0 for full balance).
    function withdrawPayments(address token, uint256 amount) external onlyOwner {
        IERC20Upgradeable erc20 = IERC20Upgradeable(token);
        uint256 bal = erc20.balanceOf(address(this));
        if (amount == 0) {
            amount = bal;
        } else {
            require(amount <= bal, "Insufficient balance");
        }
        require(erc20.transfer(owner(), amount), "Transfer failed");
        emit PaymentsWithdrawn(token, amount);
    }
}

