// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SQMU Property Escrow
/// @notice Non-upgradeable escrow implementation intended for EIP-1167 clones.
contract Escrow is Initializable {
    using SafeERC20 for IERC20;

    enum Stage {
        EOI,
        Deposit,
        Final
    }

    enum ActionType {
        Release,
        Refund
    }

    enum LifecycleState {
        Created,
        Active,
        Completed,
        Cancelled,
        Expired
    }

    enum StageSettlement {
        Unsettled,
        Released,
        Refunded
    }

    struct StageData {
        uint256 targetAmount;
        uint256 depositedAmount;
        uint256 heldAmount;
        StageSettlement settlement;
    }

    struct ActionData {
        ActionType actionType;
        Stage stage;
        address proposer;
        uint8 confirmationCount;
        bool executed;
    }

    error ActionAlreadyConfirmed(uint256 actionId, address signer);
    error ActionAlreadyExecuted(uint256 actionId);
    error ActionNotFound(uint256 actionId);
    error DuplicateParticipant();
    error EscrowUnavailable(LifecycleState state);
    error InvalidDeadline();
    error InvalidPropertyRef();
    error InvalidStageTarget();
    error NotBuyer(address caller);
    error NotParticipant(address caller);
    error StageAlreadySettled(Stage stage);
    error StageHasNoFunds(Stage stage);
    error StageOverfunded(Stage stage, uint256 attemptedTotal, uint256 targetAmount);
    error ZeroAddress();

    uint8 public constant APPROVAL_THRESHOLD = 2;

    address public factory;
    address public buyer;
    address public seller;
    address public agent;
    IERC20 public paymentToken;
    bytes32 public propertyRef;
    uint256 public deadline;

    uint256 private _actionCount;
    bool private _hasRefundedStage;
    bool private _reentrancyLock;

    mapping(uint8 => StageData) private _stages;
    mapping(uint256 => ActionData) private _actions;
    mapping(uint256 => mapping(address => bool)) private _actionConfirmations;

    event ActionConfirmed(uint256 indexed actionId, address indexed signer, uint8 confirmationCount);
    event ActionProposed(
        uint256 indexed actionId,
        ActionType indexed actionType,
        Stage indexed stage,
        address proposer
    );
    event EscrowInitialized(
        address indexed factory,
        address indexed buyer,
        address indexed seller,
        address agent,
        address token,
        bytes32 propertyRef,
        uint256 deadline
    );
    event LifecycleStateChanged(LifecycleState newState);
    event StageDeposited(Stage indexed stage, address indexed buyer, uint256 amount, uint256 heldAmount);
    event StageRefunded(Stage indexed stage, uint256 indexed actionId, address indexed buyer, uint256 amount);
    event StageReleased(Stage indexed stage, uint256 indexed actionId, address indexed seller, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyBuyer() {
        if (msg.sender != buyer) {
            revert NotBuyer(msg.sender);
        }
        _;
    }

    modifier onlyParticipant() {
        if (!_isParticipant(msg.sender)) {
            revert NotParticipant(msg.sender);
        }
        _;
    }

    modifier nonReentrant() {
        require(!_reentrancyLock, "reentrant call");
        _reentrancyLock = true;
        _;
        _reentrancyLock = false;
    }

    function initialize(
        address buyer_,
        address seller_,
        address agent_,
        address token_,
        bytes32 propertyRef_,
        uint256 deadline_,
        uint256 eoiTarget_,
        uint256 depositTarget_,
        uint256 finalTarget_
    ) external initializer {
        if (buyer_ == address(0) || seller_ == address(0) || agent_ == address(0) || token_ == address(0)) {
            revert ZeroAddress();
        }
        if (buyer_ == seller_ || buyer_ == agent_ || seller_ == agent_) {
            revert DuplicateParticipant();
        }
        if (propertyRef_ == bytes32(0)) {
            revert InvalidPropertyRef();
        }
        if (deadline_ <= block.timestamp) {
            revert InvalidDeadline();
        }
        if (eoiTarget_ == 0 || depositTarget_ == 0 || finalTarget_ == 0) {
            revert InvalidStageTarget();
        }

        factory = msg.sender;
        buyer = buyer_;
        seller = seller_;
        agent = agent_;
        paymentToken = IERC20(token_);
        propertyRef = propertyRef_;
        deadline = deadline_;

        _stages[uint8(Stage.EOI)].targetAmount = eoiTarget_;
        _stages[uint8(Stage.Deposit)].targetAmount = depositTarget_;
        _stages[uint8(Stage.Final)].targetAmount = finalTarget_;

        emit EscrowInitialized(factory, buyer_, seller_, agent_, token_, propertyRef_, deadline_);
        emit LifecycleStateChanged(LifecycleState.Created);
    }

    function deposit(Stage stage, uint256 amount) external onlyBuyer nonReentrant {
        LifecycleState previousState = currentState();
        if (
            previousState == LifecycleState.Completed
                || previousState == LifecycleState.Cancelled
                || previousState == LifecycleState.Expired
        ) {
            revert EscrowUnavailable(previousState);
        }
        if (amount == 0) {
            revert InvalidStageTarget();
        }

        StageData storage stageData = _stages[uint8(stage)];
        if (stageData.settlement != StageSettlement.Unsettled) {
            revert StageAlreadySettled(stage);
        }

        uint256 attemptedTotal = stageData.depositedAmount + amount;
        if (attemptedTotal > stageData.targetAmount) {
            revert StageOverfunded(stage, attemptedTotal, stageData.targetAmount);
        }

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        stageData.depositedAmount += amount;
        stageData.heldAmount += amount;

        emit StageDeposited(stage, msg.sender, amount, stageData.heldAmount);
        _emitLifecycleChange(previousState);
    }

    function proposeRelease(Stage stage) external onlyParticipant returns (uint256 actionId) {
        LifecycleState state = currentState();
        if (
            state == LifecycleState.Completed
                || state == LifecycleState.Cancelled
                || state == LifecycleState.Expired
        ) {
            revert EscrowUnavailable(state);
        }

        _requireStageActionable(stage);
        return _createAction(ActionType.Release, stage);
    }

    function proposeRefund(Stage stage) external onlyParticipant returns (uint256 actionId) {
        LifecycleState state = currentState();
        if (state == LifecycleState.Completed) {
            revert EscrowUnavailable(state);
        }

        _requireStageActionable(stage);
        return _createAction(ActionType.Refund, stage);
    }

    function confirmAction(uint256 actionId) external onlyParticipant {
        ActionData storage action = _actions[actionId];
        if (action.proposer == address(0)) {
            revert ActionNotFound(actionId);
        }
        if (action.executed) {
            revert ActionAlreadyExecuted(actionId);
        }
        if (_actionConfirmations[actionId][msg.sender]) {
            revert ActionAlreadyConfirmed(actionId, msg.sender);
        }

        _requireActionStillValid(action);

        _actionConfirmations[actionId][msg.sender] = true;
        action.confirmationCount += 1;

        emit ActionConfirmed(actionId, msg.sender, action.confirmationCount);

        if (action.confirmationCount >= APPROVAL_THRESHOLD) {
            _executeAction(actionId, action);
        }
    }

    function currentState() public view returns (LifecycleState) {
        if (_hasRefundedStage) {
            return LifecycleState.Cancelled;
        }
        if (_allStagesReleased()) {
            return LifecycleState.Completed;
        }
        if (block.timestamp >= deadline) {
            return LifecycleState.Expired;
        }
        if (_hasAnyDeposits()) {
            return LifecycleState.Active;
        }
        return LifecycleState.Created;
    }

    function getParticipants() external view returns (address buyer_, address seller_, address agent_) {
        return (buyer, seller, agent);
    }

    function getStageDetails(Stage stage)
        external
        view
        returns (uint256 targetAmount, uint256 depositedAmount, uint256 heldAmount, StageSettlement settlement)
    {
        StageData storage stageData = _stages[uint8(stage)];
        return (stageData.targetAmount, stageData.depositedAmount, stageData.heldAmount, stageData.settlement);
    }

    function getAction(uint256 actionId)
        external
        view
        returns (
            ActionType actionType,
            Stage stage,
            address proposer,
            uint8 confirmationCount,
            bool executed,
            bool buyerConfirmed,
            bool sellerConfirmed,
            bool agentConfirmed
        )
    {
        ActionData storage action = _actions[actionId];
        if (action.proposer == address(0)) {
            revert ActionNotFound(actionId);
        }

        return (
            action.actionType,
            action.stage,
            action.proposer,
            action.confirmationCount,
            action.executed,
            _actionConfirmations[actionId][buyer],
            _actionConfirmations[actionId][seller],
            _actionConfirmations[actionId][agent]
        );
    }

    function actionCount() external view returns (uint256) {
        return _actionCount;
    }

    function isParticipant(address account) external view returns (bool) {
        return _isParticipant(account);
    }

    function totalHeldBalance() external view returns (uint256) {
        return _stages[uint8(Stage.EOI)].heldAmount
            + _stages[uint8(Stage.Deposit)].heldAmount
            + _stages[uint8(Stage.Final)].heldAmount;
    }

    function _createAction(ActionType actionType, Stage stage) internal returns (uint256 actionId) {
        actionId = ++_actionCount;

        ActionData storage action = _actions[actionId];
        action.actionType = actionType;
        action.stage = stage;
        action.proposer = msg.sender;
        action.confirmationCount = 1;

        _actionConfirmations[actionId][msg.sender] = true;

        emit ActionProposed(actionId, actionType, stage, msg.sender);
        emit ActionConfirmed(actionId, msg.sender, action.confirmationCount);
    }

    function _executeAction(uint256 actionId, ActionData storage action) internal nonReentrant {
        LifecycleState previousState = currentState();
        StageData storage stageData = _stages[uint8(action.stage)];
        uint256 amount = stageData.heldAmount;
        if (amount == 0) {
            revert StageHasNoFunds(action.stage);
        }

        action.executed = true;
        stageData.heldAmount = 0;

        if (action.actionType == ActionType.Release) {
            stageData.settlement = StageSettlement.Released;
            paymentToken.safeTransfer(seller, amount);
            emit StageReleased(action.stage, actionId, seller, amount);
        } else {
            stageData.settlement = StageSettlement.Refunded;
            _hasRefundedStage = true;
            paymentToken.safeTransfer(buyer, amount);
            emit StageRefunded(action.stage, actionId, buyer, amount);
        }

        _emitLifecycleChange(previousState);
    }

    function _requireActionStillValid(ActionData storage action) internal view {
        _requireStageActionable(action.stage);

        LifecycleState state = currentState();
        if (action.actionType == ActionType.Release) {
            if (
                state == LifecycleState.Completed
                    || state == LifecycleState.Cancelled
                    || state == LifecycleState.Expired
            ) {
                revert EscrowUnavailable(state);
            }
        } else if (state == LifecycleState.Completed) {
            revert EscrowUnavailable(state);
        }
    }

    function _requireStageActionable(Stage stage) internal view {
        StageData storage stageData = _stages[uint8(stage)];
        if (stageData.settlement != StageSettlement.Unsettled) {
            revert StageAlreadySettled(stage);
        }
        if (stageData.heldAmount == 0) {
            revert StageHasNoFunds(stage);
        }
    }

    function _allStagesReleased() internal view returns (bool) {
        return _stages[uint8(Stage.EOI)].settlement == StageSettlement.Released
            && _stages[uint8(Stage.Deposit)].settlement == StageSettlement.Released
            && _stages[uint8(Stage.Final)].settlement == StageSettlement.Released;
    }

    function _hasAnyDeposits() internal view returns (bool) {
        return _stages[uint8(Stage.EOI)].depositedAmount > 0
            || _stages[uint8(Stage.Deposit)].depositedAmount > 0
            || _stages[uint8(Stage.Final)].depositedAmount > 0;
    }

    function _isParticipant(address account) internal view returns (bool) {
        return account == buyer || account == seller || account == agent;
    }

    function _emitLifecycleChange(LifecycleState previousState) internal {
        LifecycleState newState = currentState();
        if (newState != previousState) {
            emit LifecycleStateChanged(newState);
        }
    }
}
