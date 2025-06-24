// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title SQMU Distributor
 * @notice Transfers SQMU tokens from a treasury wallet to buyers.
 * The treasury must approve this contract to spend its SQMU balance.
 */
contract SqmuDistributor {
    address public owner;
    address public treasury;
    IERC20 public immutable sqmu;

    event Distributed(address indexed to, uint256 amount);
    event TreasuryChanged(address indexed newTreasury);
    event OwnerChanged(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _sqmu, address _treasury) {
        owner = msg.sender;
        sqmu = IERC20(_sqmu);
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryChanged(_treasury);
    }

    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
        emit OwnerChanged(_owner);
    }

    /// @notice Transfer SQMU from treasury to `to`.
    function distribute(address to, uint256 amount) external onlyOwner {
        require(sqmu.transferFrom(treasury, to, amount), "transfer failed");
        emit Distributed(to, amount);
    }
}
