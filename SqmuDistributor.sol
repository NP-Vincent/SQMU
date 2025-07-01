// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SQMU Distributor
 * @notice Transfers SQMU tokens from a treasury wallet to buyers.
 * The treasury must approve this contract to spend its SQMU balance.
 * Use {available} to check how many SQMU remain in the treasury.
 */
contract SqmuDistributor {
    address public owner;
    address public treasury;
    IERC20 public immutable sqmu;
    IERC20 public immutable stable;
    uint256 public constant STABLE_DECIMALS = 6;
    uint256 public commissionBps = 200; // 2% commission
    mapping(string => address) public agentCodes;

    event Distributed(address indexed to, uint256 buyerAmount, address indexed agent, uint256 agentAmount);
    event TreasuryChanged(address indexed newTreasury);
    event OwnerChanged(address indexed newOwner);
    event AgentCodeSet(string code, address indexed agent);
    event CommissionBpsChanged(uint256 newBps);
    event StableCommissionPaid(address indexed agent, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _sqmu, address _stable, address _treasury) {
        owner = msg.sender;
        sqmu = IERC20(_sqmu);
        stable = IERC20(_stable);
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

    function setCommissionBps(uint256 newBps) external onlyOwner {
        require(newBps <= 1000, "Too high");
        commissionBps = newBps;
        emit CommissionBpsChanged(newBps);
    }

    function setAgentCode(string calldata code, address agent) external onlyOwner {
        require(bytes(code).length > 0, "Empty code");
        require(agent != address(0), "Zero address");
        agentCodes[code] = agent;
        emit AgentCodeSet(code, agent);
    }

    /// @notice Returns the SQMU balance currently held in the treasury.
    function available() external view returns (uint256) {
        return sqmu.balanceOf(treasury);
    }

    /// @notice Owner transfers SQMU from treasury to `to` with optional agent commission.
    function distribute(address to, uint256 amount, string calldata agentCode) external onlyOwner {
        address agent = agentCodes[agentCode];
        uint256 agentAmount = 0;
        uint256 buyerAmount = amount;
        uint256 stableAmount = 0;

        if (agent != address(0) && commissionBps > 0) {
            agentAmount = (amount * commissionBps) / 10000;
            buyerAmount = amount - agentAmount;
            stableAmount = (agentAmount * 10 ** STABLE_DECIMALS) / 100; // SQMU at $0.01
            require(sqmu.transferFrom(treasury, agent, agentAmount), "agent transfer failed");
            require(stable.transferFrom(treasury, agent, stableAmount), "stable transfer failed");
            emit StableCommissionPaid(agent, stableAmount);
        }

        require(sqmu.transferFrom(treasury, to, buyerAmount), "buyer transfer failed");
        emit Distributed(to, buyerAmount, agent, agentAmount);
    }
}
