// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICurvePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external returns (uint256);
}

contract CurveAdapter {
    using SafeERC20 for IERC20;

    ICurvePool public immutable pool;

    constructor(address _pool) {
        pool = ICurvePool(_pool);
    }

    function executeSwap(address tokenIn, address, uint256 amountIn, bytes calldata data) external returns (uint256 amountOut) {
        (int128 i, int128 j, uint256 minDy) = abi.decode(data, (int128, int128, uint256));
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(pool), amountIn);
        amountOut = pool.exchange(i, j, amountIn, minDy);
    }
}
