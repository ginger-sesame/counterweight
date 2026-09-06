// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {StrategyTypes as S} from "../../contracts/libraries/StrategyTypes.sol";
import {QuoteMath} from "../../contracts/libraries/QuoteMath.sol";
import {StrategyPrototype} from "../../contracts/StrategyPrototype.sol";

contract MathHarness {
    function raw(S.Config memory c, S.Inventory memory i, bool wethIn, uint256 amount, S.Tuning memory t)
        external
        pure
        returns (uint256, uint256, int256)
    {
        return QuoteMath.calculate(c, i, wethIn, amount, QuoteMath.boundedTuning(t));
    }
}

contract StrategyTest is Test {
    StrategyPrototype internal strategy;
    MathHarness internal math;
    S.Config internal c;

    function setUp() public {
        c = S.Config(S.WETH, S.USDC, address(this), 1, 1000, 2800, 5000, 3000, 7000, 2e9, 1e9);
        vm.warp(1000);
        strategy = new StrategyPrototype(c);
        math = new MathHarness();
    }

    function inv(uint256 w, uint256 u) internal pure returns (S.Inventory memory) {
        return S.Inventory(w, u, w, u);
    }

    function request(bool wethIn, uint256 amount) internal pure returns (S.Request memory) {
        return S.Request(wethIn ? S.WETH : S.USDC, amount, true, false);
    }

    function normal() internal pure returns (S.Tuning memory) {
        return S.Tuning(true, 1000, 30);
    }

    function strUint(string memory json, string memory path) internal pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(json, path));
    }

    // S-01/02/03/04/05: immutable, independently specified golden examples, including rejections.
    function test_GoldenQuotes() public {
        string memory json = vm.readFile("planning/phase0/fixtures/accounting.json");
        for (uint256 n; n < 16; n++) {
            string memory p = string.concat(".quotes[", vm.toString(n), "].");
            S.Inventory memory i =
                inv(strUint(json, string.concat(p, "wethWei")), strUint(json, string.concat(p, "usdcUnits")));
            bool wethIn = keccak256(bytes(vm.parseJsonString(json, string.concat(p, "tokenIn")))) == keccak256("WETH");
            uint256 amount = strUint(json, string.concat(p, "amountIn"));
            (uint256 out, uint256 weight, int256 skew) = math.raw(c, i, wethIn, amount, normal());
            assertEq(out, strUint(json, string.concat(p, "expectedOut")));
            assertEq(weight, vm.parseJsonUint(json, string.concat(p, "expectedWeightBps")));
            assertEq(skew, vm.parseJsonInt(json, string.concat(p, "expectedSkewBps")));
            string memory result = vm.parseJsonString(json, string.concat(p, "expectedResult"));
            if (keccak256(bytes(result)) != keccak256("PASS")) {
                vm.expectRevert(bytes4(keccak256(bytes(string.concat(result, "()")))));
                strategy.quote(i, request(wethIn, amount), normal());
            } else {
                S.Quote memory q = strategy.quote(i, request(wethIn, amount), normal());
                assertEq(q.amountOut, out);
                assertEq(q.postWeth, strUint(json, string.concat(p, "expectedPostWethWei")));
                assertEq(q.postUsdc, strUint(json, string.concat(p, "expectedPostUsdcUnits")));
            }
        }
    }

    function test_ExactExposureBoundaries() public {
        strategy.checkPost(3e18, 14000e6);
        strategy.checkPost(3e18 + 1, 14000e6);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        strategy.checkPost(3e18 - 1, 14000e6);
        strategy.checkPost(7e18, 6000e6);
        strategy.checkPost(7e18 - 1, 6000e6);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        strategy.checkPost(7e18 + 1, 6000e6);
        vm.expectRevert(S.EmptyInventory.selector);
        strategy.checkPost(0, 0);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        strategy.checkPost(0, 1);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        strategy.checkPost(1, 0);
    }

    function test_UsdcSizeBoundary() public {
        strategy.quote(inv(10e18, 20000e6), request(false, 1e9), normal());
        vm.expectRevert(S.TradeTooLarge.selector);
        strategy.quote(inv(10e18, 20000e6), request(false, 1e9 + 1), normal());
    }

    function test_InvalidConfiguration() public {
        S.Config memory bad = c;
        bad.minWethBps = 0;
        rejectConfig(bad);
        bad = c;
        bad.minWethBps = 5000;
        rejectConfig(bad);
        bad = c;
        bad.targetWethBps = 7000;
        rejectConfig(bad);
        bad = c;
        bad.maxWethBps = 10000;
        rejectConfig(bad);
        bad = c;
        bad.priceMicroUsdc = 0;
        rejectConfig(bad);
        bad = c;
        bad.priceMicroUsdc = 1e12 + 1;
        rejectConfig(bad);
        bad = c;
        bad.maxInputValueMicroUsdc = 0;
        rejectConfig(bad);
        bad = c;
        bad.maxInputValueMicroUsdc = 1e30 + 1;
        rejectConfig(bad);
        bad = c;
        bad.owner = address(0);
        rejectConfig(bad);
        bad = c;
        bad.weth = S.USDC;
        rejectConfig(bad);
        bad = c;
        bad.usdc = address(99);
        rejectConfig(bad);
        bad = c;
        bad.epochId = 0;
        rejectConfig(bad);
        bad = c;
        bad.end = bad.start;
        rejectConfig(bad);
        bad = c;
        bad.end = bad.start - 1;
        rejectConfig(bad);
        bad = c;
        bad.end = bad.start + 1801;
        rejectConfig(bad);
    }

    function rejectConfig(S.Config memory bad) internal {
        vm.expectRevert(S.InvalidConfig.selector);
        new StrategyPrototype(bad);
    }

    function test_UnsupportedAndInvalidInputs() public {
        S.Inventory memory i = inv(10e18, 20000e6);
        S.Request memory r = request(true, 1e17);
        r.exactIn = false;
        vm.expectRevert(S.UnsupportedMode.selector);
        strategy.quote(i, r, normal());
        r = request(true, 1e17);
        r.partialFill = true;
        vm.expectRevert(S.UnsupportedMode.selector);
        strategy.quote(i, r, normal());
        r = request(true, 1e17);
        r.tokenIn = address(0);
        vm.expectRevert(S.UnsupportedToken.selector);
        strategy.quote(i, r, normal());
        vm.expectRevert(S.ZeroInput.selector);
        strategy.quote(i, request(true, 0), normal());
        vm.expectRevert(S.AmountOutOfRange.selector);
        strategy.quote(i, request(true, 1e30 + 1), normal());
        vm.expectRevert(S.AmountOutOfRange.selector);
        strategy.quote(inv(1e30 + 1, 1e6), request(true, 1), normal());
        vm.expectRevert(S.EmptyInventory.selector);
        strategy.quote(inv(0, 0), request(true, 1), normal());
        vm.expectRevert(S.ZeroOutput.selector);
        strategy.quote(i, request(true, 1), normal());
        vm.expectRevert(S.InsufficientInventory.selector);
        strategy.quote(inv(1, 1), request(true, 1e17), normal());
    }

    function test_EpochBoundariesAndValuation() public {
        S.Inventory memory i = inv(10e18, 20000e6);
        vm.warp(999);
        vm.expectRevert(S.EpochInactive.selector);
        strategy.quote(i, request(true, 1e17), normal());
        vm.warp(1000);
        strategy.quote(i, request(true, 1e17), normal());
        vm.warp(2800);
        strategy.quote(i, request(true, 1e17), normal());
        vm.warp(2801);
        vm.expectRevert(S.EpochInactive.selector);
        strategy.quote(i, request(true, 1e17), normal());
        vm.warp(1000);
        S.Config memory next = c;
        next.priceMicroUsdc = 4e9;
        next.epochId = 2;
        StrategyPrototype repriced = new StrategyPrototype(next);
        assertTrue(repriced.safetyDigest() != strategy.safetyDigest());
        // The same balances have a different defined exposure under a new approved price.
        strategy.checkPost(7e18, 6000e6);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        repriced.checkPost(7e18, 6000e6);
    }

    function test_PhysicalBackingAndExternalChanges() public {
        S.Inventory memory i = inv(10e18, 20000e6);
        S.Quote memory beforeQuote = strategy.quote(i, request(true, 1e17), normal());
        i.physicalWeth += 10e18;
        i.physicalUsdc += 1e6;
        assertEq(strategy.quote(i, request(true, 1e17), normal()).amountOut, beforeQuote.amountOut);
        i.physicalWeth = 10e18 - 1;
        vm.expectRevert(S.InventoryUnavailable.selector);
        strategy.quote(i, request(true, 1e17), normal());
        i = inv(10e18, 20000e6);
        i.physicalUsdc--;
        vm.expectRevert(S.InventoryUnavailable.selector);
        strategy.quote(i, request(false, 200e6), normal());
        i = inv(12e18, 16000e6);
        assertLt(strategy.quote(i, request(true, 1e17), normal()).amountOut, beforeQuote.amountOut);
    }

    function test_SkewCapsAndRetainedSpread() public {
        (,, int256 high) = math.raw(c, inv(99e18, 2000e6), true, 1e17, normal());
        (,, int256 low) = math.raw(c, inv(1e18, 198000e6), true, 1e17, normal());
        assertEq(high, 200);
        assertEq(low, -200);
        S.Quote memory q = strategy.quote(inv(10e18, 20000e6), request(true, 1e17), normal());
        assertEq(q.postWeth * 2e9 + q.postUsdc * 1e18, 40000e6 * 1e18 + 600000 * 1e18);
    }

    function test_MaximumArithmeticEnvelope() public {
        S.Config memory big = c;
        big.priceMicroUsdc = 1e12;
        big.maxInputValueMicroUsdc = 1e30;
        StrategyPrototype large = new StrategyPrototype(big);
        // Exactly matched value at the maximal supported USDC balance.
        large.checkPost(1e30, 1e24);
        vm.expectRevert(S.AmountOutOfRange.selector);
        large.checkPost(1e30 + 1, 1e24);
        S.Quote memory q = large.quote(inv(5e29, 5e23), request(false, 1e20), normal());
        assertGt(q.amountOut, 0);
        vm.expectRevert(S.AmountOutOfRange.selector);
        large.quote(inv(1e30, 1e24), request(true, 1e20), normal());
    }

    // S-06: Algebraically independent allowable-WETH interval, not rounded exposure comparisons.
    function testFuzz_PostGuardMatchesIndependentInterval(uint128 rawW, uint128 rawU) public {
        uint256 w = bound(rawW, 0, 1e30);
        uint256 u = bound(rawU, 0, 1e30);
        uint256 lowerNumerator = 3000 * u * 1e18;
        uint256 lowerDenominator = 7000 * 2e9;
        uint256 lower = (lowerNumerator + lowerDenominator - 1) / lowerDenominator;
        uint256 upper = 7000 * u * 1e18 / (3000 * 2e9);
        bool expected = (w + u > 0 && w >= lower && w <= upper);
        (bool ok,) = address(strategy).staticcall(abi.encodeCall(strategy.checkPost, (w, u)));
        assertEq(ok, expected);
    }

    function testFuzz_AcceptedQuotePreservesInvariant(
        uint64 rawW,
        uint64 rawU,
        uint64 rawAmount,
        bool wethIn,
        uint16 intensity,
        uint16 spread
    ) public {
        uint256 w = bound(rawW, 1e18, 20e18);
        uint256 u = bound(rawU, 2000e6, 40000e6);
        uint256 amount = bound(rawAmount, 1, wethIn ? 5e17 : 1e9);
        S.Tuning memory t = S.Tuning(true, uint16(bound(intensity, 0, 1000)), uint16(bound(spread, 10, 100)));
        (bool ok, bytes memory data) =
            address(strategy).staticcall(abi.encodeCall(strategy.quote, (inv(w, u), request(wethIn, amount), t)));
        if (!ok) {
            bytes4 reason = bytes4(data);
            assertTrue(reason == S.ExposureOutOfBounds.selector || reason == S.ZeroOutput.selector);
            return;
        }
        S.Quote memory q = abi.decode(data, (S.Quote));
        uint256 minW = (3000 * q.postUsdc * 1e18 + 7000 * 2e9 - 1) / (7000 * 2e9);
        uint256 maxW = 7000 * q.postUsdc * 1e18 / (3000 * 2e9);
        assertGe(q.postWeth, minW);
        assertLe(q.postWeth, maxW);
        assertEq(q.postWeth, wethIn ? w + amount : w - q.amountOut);
        assertEq(q.postUsdc, wethIn ? u - q.amountOut : u + amount);
    }

    function testFuzz_RegimeIsolation(uint16 intensity, uint16 spread, bool available) public {
        bytes32 digest = strategy.safetyDigest();
        S.Tuning memory t = S.Tuning(available, intensity, spread);
        S.Quote memory q = strategy.quote(inv(10e18, 20000e6), request(true, 1e17), t);
        assertLe(q.effectiveTuning.intensityBps, 1000);
        assertGe(q.effectiveTuning.spreadBps, 10);
        assertLe(q.effectiveTuning.spreadBps, 100);
        if (!available || intensity > 1000 || spread < 10 || spread > 100) {
            assertEq(q.effectiveTuning.intensityBps, 0);
            assertEq(q.effectiveTuning.spreadBps, 100);
        }
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        strategy.quote(inv(14e18, 12000e6), request(true, 1e17), t);
        strategy.checkPost(7e18, 6000e6);
        assertEq(strategy.safetyDigest(), digest);
    }

    function test_NoSafetyMutationSurface() public {
        bytes32 beforeDigest = strategy.safetyDigest();
        (bool ok,) = address(strategy).call(abi.encodeWithSignature("setMaxWethBps(uint16)", 9999));
        assertFalse(ok);
        (ok,) = address(strategy).call(abi.encodeWithSignature("setConfig(bytes)", abi.encode(c)));
        assertFalse(ok);
        assertEq(strategy.safetyDigest(), beforeDigest);
        assertEq(strategy.config().maxWethBps, 7000);
    }
}
