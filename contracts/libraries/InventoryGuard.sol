// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {StrategyTypes as S} from "./StrategyTypes.sol";

/// @notice Exact allocation accounting; never depends on market-regime inputs.
library InventoryGuard {
    function validateConfig(S.Config memory c) internal pure {
        if (
            c.weth != S.WETH || c.usdc != S.USDC || c.owner == address(0) || c.epochId == 0 || c.end <= c.start
                || uint256(c.end) - c.start > 1800 || c.minWethBps == 0 || c.minWethBps >= c.targetWethBps
                || c.targetWethBps >= c.maxWethBps || c.maxWethBps >= S.BPS || c.priceMicroUsdc == 0
                || c.priceMicroUsdc > 1e12 || c.maxInputValueMicroUsdc == 0 || c.maxInputValueMicroUsdc > S.MAX_AMOUNT
        ) {
            revert S.InvalidConfig();
        }
    }

    function checkAmount(uint256 amount) internal pure {
        if (amount > S.MAX_AMOUNT) revert S.AmountOutOfRange();
    }

    function values(uint256 weth, uint256 usdc, uint256 price) internal pure returns (uint256 a, uint256 total) {
        checkAmount(weth);
        checkAmount(usdc);
        // Callers supply the validated, immutable epoch price.
        a = weth * price;
        total = a + usdc * S.SCALE;
        if (total == 0) revert S.EmptyInventory();
    }

    function checkBacking(S.Inventory memory i) internal pure {
        checkAmount(i.weth);
        checkAmount(i.usdc);
        checkAmount(i.physicalWeth);
        checkAmount(i.physicalUsdc);
        if (i.physicalWeth < i.weth || i.physicalUsdc < i.usdc) revert S.InventoryUnavailable();
    }

    function checkSize(S.Config memory c, bool wethIn, uint256 amount) internal pure {
        checkAmount(amount);
        if (amount == 0) revert S.ZeroInput();
        if (wethIn ? amount * c.priceMicroUsdc > c.maxInputValueMicroUsdc * S.SCALE : amount > c.maxInputValueMicroUsdc)
        revert S.TradeTooLarge();
    }

    function checkPost(S.Config memory c, uint256 weth, uint256 usdc) internal pure {
        (uint256 a, uint256 total) = values(weth, usdc, c.priceMicroUsdc);
        if (a * S.BPS < c.minWethBps * total || a * S.BPS > c.maxWethBps * total) {
            revert S.ExposureOutOfBounds();
        }
    }

    function project(S.Config memory c, S.Inventory memory i, bool wethIn, uint256 amountIn, uint256 amountOut)
        internal
        pure
        returns (uint256 postWeth, uint256 postUsdc)
    {
        if (amountOut == 0) revert S.ZeroOutput();
        if (amountOut > (wethIn ? i.usdc : i.weth)) revert S.InsufficientInventory();
        postWeth = wethIn ? i.weth + amountIn : i.weth - amountOut;
        postUsdc = wethIn ? i.usdc - amountOut : i.usdc + amountIn;
        checkPost(c, postWeth, postUsdc);
    }
}
