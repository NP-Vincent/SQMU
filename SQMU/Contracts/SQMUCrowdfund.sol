// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SQMU Crowdfund Contract
/// @notice Sells pre-minted governance tokens (ID 0) for stablecoins held by this contract.
/// @dev Upgradeable via UUPS pattern. Uses Ownable for admin controls and holds ERC-1155 tokens.
contract SQMUCrowdfund is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard,
    ERC1155Holder
{
    /// ---------------------------------------------------------------------
    /// Storage
    /// ---------------------------------------------------------------------

    IERC1155 public sqmu;
    mapping(address => bool) private allowedPaymentToken;
    address[] public paymentTokens;

    uint256 public constant GOVERNANCE_ID = 0;
    /// @dev Price per governance token in USD with 18 decimals (1e18 = $1)
    uint256 public priceUSD;

    event GovernancePurchased(address indexed buyer, address token, uint256 amount, uint256 totalPaid);
    event PaymentTokenChanged(address token, bool allowed);
    event PriceUpdated(uint256 newPriceUSD);
    event PaymentsWithdrawn(address indexed token, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address sqmuAddress, uint256 priceUSD_) public initializer {
        __Ownable_init(msg.sender);
        sqmu = IERC1155(sqmuAddress);
        priceUSD = priceUSD_;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// ---------------------------------------------------------------------
    /// Crowdfund Logic
    /// ---------------------------------------------------------------------

    /// @notice Allow or disallow a payment token for crowdfund purchases.
    function allowPaymentToken(address token, bool allowed) external onlyOwner {
        allowedPaymentToken[token] = allowed;

        bool found = false;
        uint256 foundIndex = 0;
        for (uint256 i = 0; i < paymentTokens.length; i++) {
            if (paymentTokens[i] == token) {
                found = true;
                foundIndex = i;
                break;
            }
        }

        if (!found && allowed) {
            paymentTokens.push(token);
        } else if (found && !allowed) {
            uint256 lastIndex = paymentTokens.length - 1;
            for (uint256 i = foundIndex; i < lastIndex; i++) {
                paymentTokens[i] = paymentTokens[i + 1];
            }
            paymentTokens.pop();
        }

        emit PaymentTokenChanged(token, allowed);
    }

    /// @notice Purchase governance tokens by paying with a supported stablecoin.
    /// @param amount Number of governance tokens to buy.
    function buy(address paymentToken, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount required");
        require(allowedPaymentToken[paymentToken], "Token not allowed");

        IERC20 erc20 = IERC20(paymentToken);
        uint8 decimals = IERC20Metadata(paymentToken).decimals();
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
        IERC20 erc20 = IERC20(token);
        uint256 bal = erc20.balanceOf(address(this));
        if (amount == 0) {
            amount = bal;
        } else {
            require(amount <= bal, "Insufficient balance");
        }
        require(erc20.transfer(owner(), amount), "Transfer failed");
        emit PaymentsWithdrawn(token, amount);
    }

    function isAllowedToken(address token) external view returns (bool) {
        return allowedPaymentToken[token];
    }

    function getPaymentTokens() external view returns (address[] memory) {
        return paymentTokens;
    }
}
