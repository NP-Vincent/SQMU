// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.26;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title SQMU ERC-1155 Ownership Token
/// @notice Basic ERC-1155 token for SQMU fractional real estate ownership.
/// @dev Upgradeable ERC-1155 contract using the UUPS pattern. Minting and burning are controlled by the owner.
contract SQMU is Initializable, ERC1155Upgradeable, ERC1155BurnableUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice Token collection name.
    string public name;
    /// @notice Token collection symbol.
    string public symbol;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract with metadata and owner.
    /// @param uri_ Base metadata URI for all tokens.
    /// @param name_ Token collection name.
    /// @param symbol_ Token collection symbol.
    /// @param initialOwner Address to receive ownership of the contract.
    function initialize(
        string memory uri_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) public initializer {
        __ERC1155_init(uri_);
        __ERC1155Burnable_init();
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        name = name_;
        symbol = symbol_;
    }

    /// @notice Mint new tokens.
    /// @param account Recipient address.
    /// @param id Token ID to mint.
    /// @param amount Amount of tokens to mint.
    /// @param data Additional data passed to the receiver.
    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
        onlyOwner
    {
        _mint(account, id, amount, data);
    }

    /// @notice Mint multiple token types in a single call.
    /// @param to Recipient address.
    /// @param ids Array of token IDs to mint.
    /// @param amounts Array of amounts to mint for each token ID.
    /// @param data Additional data passed to the receiver.
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyOwner
    {
        _mintBatch(to, ids, amounts, data);
    }

    /// @dev Required by UUPS pattern to authorize upgrades.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
