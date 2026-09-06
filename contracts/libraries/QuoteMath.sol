// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {StrategyTypes as S} from "./StrategyTypes.sol";
import {InventoryGuard as Guard} from "./InventoryGuard.sol";

library QuoteMath {
    function boundedTuning(S.Tuning memory supplied) internal pure returns (S.Tuning memory) {
        if (!supplied.available || supplied.intensityBps > 1000 || supplied.spreadBps < 10 || supplied.spreadBps > 100)
        {
            return S.Tuning(false, 0, 100);
        }
        return supplied;
    }

    /// @dev The pipeline must validate configuration, inventory envelope and input size first.
    function calculate(S.Config memory c, S.Inventory memory i, bool wethIn, uint256 input, S.Tuning memory tuning)
        internal
        pure
        returns (uint256 output, uint256 weight, int256 skew)
    {
        (uint256 a, uint256 total) = Guard.values(i.weth, i.usdc, c.priceMicroUsdc);
        weight = S.BPS * a / total;
        skew =
            (int256(weight) - int256(uint256(c.targetWethBps))) * int256(uint256(tuning.intensityBps)) / int256(S.BPS);
        if (skew > 200) skew = 200;
        if (skew < -200) skew = -200;
        uint256 shifted = uint256(int256(S.BPS) - skew);
        if (wethIn) {
            output = input * c.priceMicroUsdc * shifted * (S.BPS - tuning.spreadBps) / (S.SCALE * S.BPS * S.BPS);
        } else {
            output = input * S.SCALE * S.BPS * S.BPS / (c.priceMicroUsdc * shifted * (S.BPS + tuning.spreadBps));
        }
    }
}
