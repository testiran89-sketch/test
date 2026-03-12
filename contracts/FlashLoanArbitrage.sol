// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IAavePool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract FlashLoanArbitrage is IFlashLoanSimpleReceiver {
    address public immutable owner;
    IAavePool public immutable aavePool;

    error OnlyOwner();
    error NotAavePool();
    error BadInitiator();
    error Unprofitable(uint256 finalBalance, uint256 repayment);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    struct ArbParams {
        address buyRouter;
        address sellRouter;
        address tokenBorrow; // USDC
        address tokenOther;  // CRV (or target token)
        address[] buyPath;
        address[] sellPath;
        uint256 minOutBuy;
        uint256 minOutSell;
        uint256 deadline;
    }

    constructor(address _aavePool) {
        owner = msg.sender;
        aavePool = IAavePool(_aavePool);
    }

    function startArbitrage(
        uint256 amount,
        ArbParams calldata params
    ) external onlyOwner {
        bytes memory data = abi.encode(params);
        aavePool.flashLoanSimple(address(this), params.tokenBorrow, amount, data, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(aavePool)) revert NotAavePool();
        if (initiator != address(this)) revert BadInitiator();

        ArbParams memory p = abi.decode(params, (ArbParams));
        require(asset == p.tokenBorrow, 'asset mismatch');

        _approveIfNeeded(p.tokenBorrow, p.buyRouter, amount);

        require(p.buyPath.length >= 2, 'bad buy path');
        require(p.sellPath.length >= 2, 'bad sell path');
        require(p.buyPath[0] == p.tokenBorrow, 'buy path start');
        require(p.buyPath[p.buyPath.length - 1] == p.tokenOther, 'buy path end');
        require(p.sellPath[0] == p.tokenOther, 'sell path start');
        require(p.sellPath[p.sellPath.length - 1] == p.tokenBorrow, 'sell path end');

        IUniswapV2Router(p.buyRouter).swapExactTokensForTokens(
            amount,
            p.minOutBuy,
            p.buyPath,
            address(this),
            p.deadline
        );

        uint256 midBalance = IERC20(p.tokenOther).balanceOf(address(this));
        _approveIfNeeded(p.tokenOther, p.sellRouter, midBalance);

        IUniswapV2Router(p.sellRouter).swapExactTokensForTokens(
            midBalance,
            p.minOutSell,
            p.sellPath,
            address(this),
            p.deadline
        );

        uint256 finalBalance = IERC20(p.tokenBorrow).balanceOf(address(this));
        uint256 repayment = amount + premium;

        // Always execute if loan repayment is possible.
        // Any leftover balance (even very small profit) remains in contract and is withdrawable.
        if (finalBalance < repayment) {
            revert Unprofitable(finalBalance, repayment);
        }

        _approveIfNeeded(p.tokenBorrow, address(aavePool), repayment);
        return true;
    }

    function withdrawToken(address token, uint256 amount, address to) external onlyOwner {
        require(IERC20(token).transfer(to, amount), 'withdraw failed');
    }

    function quoteRouterOut(address router, uint256 amountIn, address tokenIn, address tokenOut)
        external
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint[] memory amounts = IUniswapV2Router(router).getAmountsOut(amountIn, path);
        return amounts[1];
    }

    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        uint256 allowance = IERC20(token).allowance(address(this), spender);
        if (allowance < amount) {
            require(IERC20(token).approve(spender, 0), 'approve0 failed');
            require(IERC20(token).approve(spender, type(uint256).max), 'approve failed');
        }
    }
}
