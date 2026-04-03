// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

contract MockPriceDistributor {
    uint256 public unitPrice;

    function setUnitPrice(uint256 newUnitPrice) external {
        unitPrice = newUnitPrice;
    }

    function getPrice(string calldata, uint256 sqmuAmount) external view returns (uint256) {
        return unitPrice * sqmuAmount;
    }
}
