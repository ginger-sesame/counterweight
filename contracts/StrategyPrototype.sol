// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {StrategyTypes as S} from "./libraries/StrategyTypes.sol";
import {InventoryGuard as Guard} from "./libraries/InventoryGuard.sol";
import {QuoteMath} from "./libraries/QuoteMath.sol";

/// @notice Read-only simulator of the strategy pipeline. No tokens, swaps or signing authority.
/// @dev Inventory is caller-supplied here. Phase 2 must obtain execution-state balances from Aqua/ERC20s.
contract StrategyPrototype {
    S.Config private _config; // Constructor-only; no configuration or delegatecall update surface.
    bytes32 public immutable safetyDigest;

    constructor(S.Config memory config_) {
        Guard.validateConfig(config_);
        _config = config_;
        safetyDigest = keccak256(abi.encode(config_));
    }

    function config() external view returns (S.Config memory) {
        return _config;
    }

    function quote(S.Inventory memory inventory, S.Request memory request, S.Tuning memory tuning)
        external
        view
        returns (S.Quote memory result)
    {
        S.Config memory c = _config;
        if (!request.exactIn || request.partialFill) revert S.UnsupportedMode();
        if (request.tokenIn != c.weth && request.tokenIn != c.usdc) revert S.UnsupportedToken();
        if (block.timestamp < c.start || block.timestamp > c.end) revert S.EpochInactive();
        Guard.checkAmount(request.amountIn);
        if (request.amountIn == 0) revert S.ZeroInput();
        Guard.checkBacking(inventory);
        bool wethIn = request.tokenIn == c.weth;
        Guard.checkSize(c, wethIn, request.amountIn);
        result.effectiveTuning = QuoteMath.boundedTuning(tuning);
        (result.amountOut, result.weightBps, result.skewBps) =
            QuoteMath.calculate(c, inventory, wethIn, request.amountIn, result.effectiveTuning);
        (result.postWeth, result.postUsdc) = Guard.project(c, inventory, wethIn, request.amountIn, result.amountOut);
    }

    /// @notice Independent safety decision for already-computed post-state; tuning is not an argument.
    function checkPost(uint256 weth, uint256 usdc) external view {
        Guard.checkPost(_config, weth, usdc);
    }
}
