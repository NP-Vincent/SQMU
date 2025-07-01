// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

struct SQMUProp {
    IERC20 token;
    address treasury;
}

/**
 * @title MultiSqmuDistributor
 * @notice Allows the owner to register multiple SQMU tokens and distribute them
 *         from their respective treasuries with optional agent commissions.
 */
contract MultiSqmuDistributor {
    address public owner;
    IERC20 public immutable stable;
    uint256 public constant STABLE_DECIMALS = 6;
    uint256 public commissionBps = 200;

    mapping(string => SQMUProp) public properties;
    mapping(string => address) public agentCodes;

    event PropertySet(string indexed code, address token, address treasury);
    event Distributed(string indexed code, address indexed to, uint256 buyerAmount, address indexed agent, uint256 agentAmount);
    event StableCommissionPaid(address indexed agent, uint256 amount);
    event CommissionBpsChanged(uint256 newBps);
    event AgentCodeSet(string code, address indexed agent);
    event OwnerChanged(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _stable) {
        owner = msg.sender;
        stable = IERC20(_stable);
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

    /// @notice Register or update a property token and treasury.
    function setProperty(string calldata code, address token, address treasury) external onlyOwner {
        require(bytes(code).length > 0, "code");
        require(token != address(0) && treasury != address(0), "zero");
        properties[code] = SQMUProp(IERC20(token), treasury);
        emit PropertySet(code, token, treasury);
    }

    /// @notice Returns the SQMU balance for a property treasury.
    function getAvailable(string calldata code) external view returns (uint256) {
        SQMUProp storage p = properties[code];
        if (address(p.token) == address(0)) return 0;
        return p.token.balanceOf(p.treasury);
    }

    /// @notice Owner transfers SQMU from the property's treasury with optional agent commission.
    function distribute(string calldata code, address to, uint256 amount, string calldata agentCode) external onlyOwner {
        SQMUProp storage p = properties[code];
        require(address(p.token) != address(0), "missing property");

        address agent = agentCodes[agentCode];
        uint256 agentAmount = 0;
        uint256 buyerAmount = amount;
        uint256 stableAmount = 0;

        if (agent != address(0) && commissionBps > 0) {
            agentAmount = (amount * commissionBps) / 10000;
            buyerAmount = amount - agentAmount;
            stableAmount = (agentAmount * 10 ** STABLE_DECIMALS) / 100; // SQMU at $0.01
            require(p.token.transferFrom(p.treasury, agent, agentAmount), "agent SQMU failed");
            require(stable.transferFrom(p.treasury, agent, stableAmount), "stable failed");
            emit StableCommissionPaid(agent, stableAmount);
        }

        require(p.token.transferFrom(p.treasury, to, buyerAmount), "buyer transfer failed");
        emit Distributed(code, to, buyerAmount, agent, agentAmount);
    }
}
