// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract SushiAdapter {
    using SafeERC20 for IERC20;

    IUniV2Router public immutable router;

    constructor(address _router) {
        router = IUniV2Router(_router);
    }

    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, bytes calldata data)
        external
        returns (uint256 amountOut)
    {
        uint256 amountOutMin = abi.decode(data, (uint256));
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(address(router), 0);
        IERC20(tokenIn).safeApprove(address(router), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts = router.swapExactTokensForTokens(amountIn, amountOutMin, path, msg.sender, block.timestamp);
        amountOut = amounts[amounts.length - 1];
    }
}
