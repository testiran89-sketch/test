// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAavePool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IFlashLoanRecipient {
    function receiveFlashLoan(address[] memory tokens, uint256[] memory amounts, uint256[] memory feeAmounts, bytes memory userData)
        external;
}

interface IFlashLoanProvider {
    function flashLoan(
        IFlashLoanRecipient recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface ISwapAdapter {
    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, bytes calldata data)
        external
        returns (uint256 amountOut);
}

/**
 * @title ArbitrageExecutor
 * @notice Executes MEV arbitrage plans with optional Aave/Balancer flash loans.
 * @dev Always run off-chain simulation before calling executeArbitrage.
 */
contract ArbitrageExecutor is ReentrancyGuard, Ownable, IFlashLoanRecipient {
    using SafeERC20 for IERC20;

    enum FlashLoanProvider {
        NONE,
        AAVE,
        BALANCER
    }

    struct SwapStep {
        address adapter;
        address tokenIn;
        address tokenOut;
        bytes data;
    }

    struct ArbPlan {
        FlashLoanProvider provider;
        address flashLoanToken;
        uint256 flashLoanAmount;
        SwapStep[] steps;
        uint256 minProfit;
        uint256 deadline;
        bytes32 opportunityId;
    }

    uint256 public slippageToleranceBps = 50;
    uint256 public maxGasPrice;
    uint256 public minProfitThreshold;
    bool public paused;

    address public immutable usdc;
    IAavePool public immutable aavePool;
    IFlashLoanProvider public immutable balancerVault;

    error TradingPaused();
    error DeadlineExpired();
    error GasPriceTooHigh();
    error InvalidPlan();
    error NotFlashLoanProvider();
    error InsufficientProfit();

    event CandidateSeen(bytes32 indexed opportunityId, address indexed caller);
    event FlashLoanTaken(FlashLoanProvider provider, address indexed token, uint256 amount);
    event SwapStepExecuted(address indexed adapter, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event ProfitRealized(bytes32 indexed opportunityId, uint256 profit, address indexed receiver);
    event RevertedWithReason(bytes32 indexed opportunityId, string reason);
    event PausedSet(bool pausedState);

    constructor(address _usdc, address _aavePool, address _balancerVault, address owner_) Ownable(owner_) {
        usdc = _usdc;
        aavePool = IAavePool(_aavePool);
        balancerVault = IFlashLoanProvider(_balancerVault);
    }

    /// @notice Main entry point for bundle execution.
    function executeArbitrage(ArbPlan calldata plan) external nonReentrant {
        _validate(plan);
        emit CandidateSeen(plan.opportunityId, msg.sender);

        if (plan.provider == FlashLoanProvider.NONE) {
            _executePlan(plan, 0);
            return;
        }

        bytes memory encoded = abi.encode(plan, msg.sender);
        if (plan.provider == FlashLoanProvider.AAVE) {
            emit FlashLoanTaken(plan.provider, plan.flashLoanToken, plan.flashLoanAmount);
            aavePool.flashLoanSimple(address(this), plan.flashLoanToken, plan.flashLoanAmount, encoded, 0);
        } else {
            address[] memory tokens = new address[](1);
            uint256[] memory amounts = new uint256[](1);
            tokens[0] = plan.flashLoanToken;
            amounts[0] = plan.flashLoanAmount;
            emit FlashLoanTaken(plan.provider, plan.flashLoanToken, plan.flashLoanAmount);
            balancerVault.flashLoan(this, tokens, amounts, encoded);
        }
    }

    /// @notice Aave callback.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(aavePool)) revert NotFlashLoanProvider();
        (ArbPlan memory plan, address receiver) = abi.decode(params, (ArbPlan, address));
        _executePlan(plan, premium);
        IERC20(asset).forceApprove(address(aavePool), amount + premium);
        _payout(receiver, plan.opportunityId);
        return true;
    }

    /// @notice Balancer callback.
    function receiveFlashLoan(address[] memory tokens, uint256[] memory amounts, uint256[] memory feeAmounts, bytes memory userData)
        external
        override
    {
        if (msg.sender != address(balancerVault)) revert NotFlashLoanProvider();
        (ArbPlan memory plan, address receiver) = abi.decode(userData, (ArbPlan, address));
        _executePlan(plan, feeAmounts[0]);
        IERC20(tokens[0]).safeTransfer(address(balancerVault), amounts[0] + feeAmounts[0]);
        _payout(receiver, plan.opportunityId);
    }

    function _executePlan(ArbPlan memory plan, uint256 loanFee) internal {
        uint256 amount = plan.flashLoanAmount;
        if (plan.provider == FlashLoanProvider.NONE && plan.steps.length > 0) {
            amount = IERC20(plan.steps[0].tokenIn).balanceOf(address(this));
        }

        for (uint256 i = 0; i < plan.steps.length; ++i) {
            SwapStep memory step = plan.steps[i];
            IERC20(step.tokenIn).forceApprove(step.adapter, amount);
            uint256 out = ISwapAdapter(step.adapter).executeSwap(step.tokenIn, step.tokenOut, amount, step.data);
            emit SwapStepExecuted(step.adapter, step.tokenIn, step.tokenOut, amount, out);
            amount = out;
        }

        uint256 totalCost = plan.flashLoanAmount + loanFee + minProfitThreshold;
        if (amount <= totalCost || amount - totalCost < plan.minProfit) revert InsufficientProfit();
    }

    function _payout(address receiver, bytes32 id) internal {
        uint256 profit = IERC20(usdc).balanceOf(address(this));
        if (profit < minProfitThreshold) revert InsufficientProfit();
        IERC20(usdc).safeTransfer(receiver, profit);
        emit ProfitRealized(id, profit, receiver);
    }

    function _validate(ArbPlan calldata plan) internal view {
        if (paused) revert TradingPaused();
        if (block.timestamp > plan.deadline) revert DeadlineExpired();
        if (tx.gasprice > maxGasPrice) revert GasPriceTooHigh();
        if (plan.steps.length == 0) revert InvalidPlan();
    }

    function setRiskParams(uint256 _slippageToleranceBps, uint256 _minProfitThreshold, uint256 _maxGasPrice) external onlyOwner {
        slippageToleranceBps = _slippageToleranceBps;
        minProfitThreshold = _minProfitThreshold;
        maxGasPrice = _maxGasPrice;
    }

    function setPaused(bool pausedState) external onlyOwner {
        paused = pausedState;
        emit PausedSet(pausedState);
    }
}
