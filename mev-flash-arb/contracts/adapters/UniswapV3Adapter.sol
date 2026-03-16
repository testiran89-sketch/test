// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract UniswapV3Adapter {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable router;

    constructor(address _router) {
        router = ISwapRouter(_router);
    }

    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, bytes calldata data)
        external
        returns (uint256 amountOut)
    {
        (uint24 fee, uint256 amountOutMinimum) = abi.decode(data, (uint24, uint256));
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(address(router), 0);
        IERC20(tokenIn).safeApprove(address(router), amountIn);
        amountOut = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
