// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

library StrategyTypes {
    uint256 internal constant SCALE = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_AMOUNT = 1e30;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    struct Config {
        address weth;
        address usdc;
        address owner;
        uint64 epochId;
        uint40 start;
        uint40 end;
        uint16 targetWethBps;
        uint16 minWethBps;
        uint16 maxWethBps;
        uint256 priceMicroUsdc;
        uint256 maxInputValueMicroUsdc;
    }

    struct Inventory {
        uint256 weth;
        uint256 usdc;
        uint256 physicalWeth;
        uint256 physicalUsdc;
    }

    // This is an observation supplied to the simulator, not authorized on-chain tuning storage.
    struct Tuning {
        bool available;
        uint16 intensityBps;
        uint16 spreadBps;
    }

    struct Request {
        address tokenIn;
        uint256 amountIn;
        bool exactIn;
        bool partialFill;
    }

    struct Quote {
        uint256 amountOut;
        uint256 postWeth;
        uint256 postUsdc;
        uint256 weightBps;
        int256 skewBps;
        Tuning effectiveTuning;
    }

    error InvalidConfig();
    error UnsupportedMode();
    error UnsupportedToken();
    error EpochInactive();
    error AmountOutOfRange();
    error ZeroInput();
    error EmptyInventory();
    error InventoryUnavailable();
    error TradeTooLarge();
    error ZeroOutput();
    error InsufficientInventory();
    error ExposureOutOfBounds();
}
