// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract SQMUSaleForward {
    address public owner;
    address public recipient; // Treasury address to receive USDT
    IERC20 public sqmu;
    IERC20 public usdt;
    uint256 public rateUSDT;

    event Purchase(address indexed buyer, uint256 usdtAmount, uint256 sqmuAmount);
    event RecipientChanged(address oldRecipient, address newRecipient);

    constructor(address _sqmu, address _usdt, address _recipient, uint256 _rateUSDT) {
        owner = msg.sender;
        sqmu = IERC20(_sqmu);
        usdt = IERC20(_usdt);
        recipient = _recipient;
        rateUSDT = _rateUSDT;
    }

    function buyWithUSDT(uint256 usdtAmount) external {
        require(usdtAmount > 0, "Amount must be > 0");
        uint8 sqmuDecimals = IERC20(sqmu).decimals();
        uint8 usdtDecimals = IERC20(usdt).decimals();
        require(usdtDecimals == 6, "USDT decimals should be 6");
        uint256 sqmuAmount = usdtAmount * (10**sqmuDecimals) / rateUSDT;
        require(sqmu.balanceOf(address(this)) >= sqmuAmount, "Insufficient SQMU in contract");
        // Transfer USDT from buyer to recipient
        require(usdt.transferFrom(msg.sender, recipient, usdtAmount), "USDT transfer failed");
        require(sqmu.transfer(msg.sender, sqmuAmount), "SQMU transfer failed");
        emit Purchase(msg.sender, usdtAmount, sqmuAmount);
    }

    function setRecipient(address newRecipient) external {
        require(msg.sender == owner, "Not owner");
        emit RecipientChanged(recipient, newRecipient);
        recipient = newRecipient;
    }

    function withdrawSQMU(uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        require(sqmu.transfer(owner, amount), "SQMU withdraw failed");
    }
}
