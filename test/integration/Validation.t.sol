// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {SettlementFixture} from "../helpers/SettlementFixture.sol";
import {CounterweightSwapVM} from "../../contracts/CounterweightSwapVM.sol";
import {EpochController} from "../../contracts/EpochController.sol";
import {StrategyTypes as S} from "../../contracts/libraries/StrategyTypes.sol";
import {OrderCodec} from "../../contracts/libraries/OrderCodec.sol";
import {TakerTraitsLib} from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import {MakerTraits} from "@1inch/swap-vm/src/libs/MakerTraits.sol";

contract ValidationTest is SettlementFixture {
    function testFuzz_WideTuningInputsCannotTruncateIntoAllowedValues(uint128 raw) public {
        uint256 invalid = uint256(raw) + 65536;
        bytes32 beforeState = stateDigest();
        uint64 version = controller.tuningVersion();
        vm.startPrank(maker);
        vm.expectRevert(EpochController.InvalidTuning.selector);
        controller.setTuning(invalid, 30, version, uint40(block.timestamp + 300));
        vm.expectRevert(EpochController.InvalidTuning.selector);
        controller.setTuning(1000, invalid, version, uint40(block.timestamp + 300));
        vm.stopPrank();
        assertEq(stateDigest(), beforeState);
    }

    function test_AllUnsupportedFlagMutationsRejectedBeforeSettlement() public {
        bytes32 beforeState = stateDigest();
        for (uint256 bit; bit < 16; bit++) {
            if (bit == 7) continue; // Supported direction selector.
            bytes memory d = data(true);
            uint256 index = bit < 8 ? 21 : 20;
            d[index] = bytes1(uint8(d[index]) ^ uint8(1 << (bit % 8)));
            vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
            router.quote(order, 1e17, d);
            vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
            router.swap(order, 1e17, d);
            assertEq(stateDigest(), beforeState);
        }
    }

    function test_OrderHashBindsTokensMakerProgramAndAllTraits() public {
        bytes memory d = data(true);
        for (uint256 n; n < 4; n++) {
            order = router.canonicalOrder();
            if (n == 0) order.maker = address(88);
            if (n == 1) order.traits = MakerTraits.wrap(MakerTraits.unwrap(order.traits) ^ (1 << 254));
            if (n == 2) order.data[0] = bytes1(uint8(order.data[0]) ^ 1);
            if (n == 3) order.data = bytes.concat(order.data, hex"d100");
            vm.expectRevert(CounterweightSwapVM.UnsupportedOrder.selector);
            router.quote(order, 1e17, d);
            vm.expectRevert(CounterweightSwapVM.UnsupportedOrder.selector);
            router.swap(order, 1e17, d);
        }
    }

    function test_CustomRecipientAndHookPayloadsAreRejected() public {
        TakerTraitsLib.Args memory a;
        a.isExactIn = true;
        a.isFirstTransferFromTaker = true;
        a.useTransferFromAndAquaPush = true;
        a.threshold = abi.encode(uint256(1));
        a.deadline = 1060;
        a.instructionsArgs = abi.encode(c.epochId, controller.tuningVersion(), uint40(1060));
        bytes32 beforeState = stateDigest();
        for (uint256 n; n < 3; n++) {
            a.to = n == 0 ? address(77) : address(0);
            a.signature = n == 1 ? bytes(hex"01") : bytes("");
            a.preTransferInHookData = n == 2 ? bytes(hex"12") : bytes("");
            bytes memory d = TakerTraitsLib.build(a);
            vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
            router.quote(order, 1e17, d);
            vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
            router.swap(order, 1e17, d);
            assertEq(stateDigest(), beforeState);
        }
    }

    function test_NewControllerStartsPausedWithFallbackAndCannotActivateUnshippedAllocation() public {
        EpochController fresh = new EpochController(c, address(aqua), address(123));
        assertTrue(fresh.paused());
        S.Tuning memory t = fresh.effectiveTuning();
        assertFalse(t.available);
        assertEq(t.intensityBps, 0);
        assertEq(t.spreadBps, 100);
        vm.startPrank(maker);
        vm.expectRevert(EpochController.Paused.selector);
        fresh.setTuning(1000, 30, 1, 1100);
        vm.expectPartialRevert(
            bytes4(keccak256("SafeBalancesForTokenNotInActiveStrategy(address,address,bytes32,address)"))
        );
        fresh.resume();
        vm.stopPrank();
    }

    function test_DeadlineBoundariesVersionAndMalformedEnvelope() public {
        bytes memory d = OrderCodec.taker(true, 1, c.epochId, controller.tuningVersion(), 1000);
        router.quote(order, 1e17, d); // Exactly now is valid.
        d = OrderCodec.taker(true, 1, c.epochId, controller.tuningVersion(), 1061);
        vm.expectRevert(CounterweightSwapVM.InvalidEnvelope.selector);
        router.quote(order, 1e17, d);
        d = OrderCodec.taker(true, 1, c.epochId, controller.tuningVersion(), 999);
        vm.expectRevert(CounterweightSwapVM.InvalidEnvelope.selector);
        router.quote(order, 1e17, d);
        d = OrderCodec.taker(true, 1, c.epochId + 1, controller.tuningVersion(), 1060);
        vm.expectRevert(EpochController.VersionMismatch.selector);
        router.quote(order, 1e17, d);
        d = data(true);
        d = bytes.concat(d, hex"00");
        vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
        router.quote(order, 1e17, d);
        TakerTraitsLib.Args memory a;
        a.isExactIn = true;
        a.isFirstTransferFromTaker = true;
        a.useTransferFromAndAquaPush = true;
        a.threshold = abi.encode(uint256(1));
        a.deadline = 1060;
        a.instructionsArgs = abi.encode(c.epochId, controller.tuningVersion());
        d = TakerTraitsLib.build(a);
        vm.expectRevert(CounterweightSwapVM.InvalidEnvelope.selector);
        router.quote(order, 1e17, d);
        vm.warp(2800);
        d = OrderCodec.taker(true, 1, c.epochId, controller.tuningVersion(), 2800);
        router.quote(order, 1e17, d);
        vm.warp(2801);
        vm.expectRevert(S.EpochInactive.selector);
        router.quote(order, 1e17, d);
    }

    function test_ThresholdNativeAndZeroAreRejectedWithoutMovement() public {
        bytes memory d = router.takerData(true, 199400001, 1060);
        bytes32 beforeState = stateDigest();
        vm.expectPartialRevert(TakerTraitsLib.TakerTraitsInsufficientMinOutputAmount.selector);
        router.quote(order, 1e17, d);
        vm.expectPartialRevert(TakerTraitsLib.TakerTraitsInsufficientMinOutputAmount.selector);
        router.swap(order, 1e17, d);
        d = router.takerData(true, 0, 1060);
        vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
        router.swap(order, 1e17, d);
        d = data(true);
        vm.deal(address(this), 1);
        vm.expectRevert(bytes4(keccak256("UnexpectedMsgValue()")));
        router.swap{value: 1}(order, 1e17, d);
        vm.expectRevert(S.ZeroInput.selector);
        router.swap(order, 0, d);
        assertEq(stateDigest(), beforeState);
    }

    function test_TuningConstraintsAndResumeRequireActualBackingAndBounds() public {
        uint64 v = controller.tuningVersion();
        bytes32 digest = controller.safetyDigest();
        vm.prank(taker);
        vm.expectRevert(EpochController.Unauthorized.selector);
        controller.setTuning(1000, 30, v, 1100);
        vm.startPrank(maker);
        vm.expectRevert(EpochController.InvalidTuning.selector);
        controller.setTuning(1001, 30, v, 1100);
        vm.expectRevert(EpochController.InvalidTuning.selector);
        controller.setTuning(1000, 9, v, 1100);
        vm.expectRevert(EpochController.InvalidTuning.selector);
        controller.setTuning(1000, 101, v, 1100);
        vm.expectRevert(EpochController.InvalidDeadline.selector);
        controller.setTuning(1000, 30, v, 1000);
        vm.expectRevert(EpochController.InvalidDeadline.selector);
        controller.setTuning(1000, 30, v, 1301);
        vm.expectRevert(EpochController.VersionMismatch.selector);
        controller.setTuning(1000, 30, v - 1, 1100);
        controller.pause();
        vm.expectRevert(EpochController.Paused.selector);
        controller.setTuning(1000, 30, v, 1100);
        weth.transfer(address(55), 1);
        vm.expectRevert(S.InventoryUnavailable.selector);
        controller.resume();
        vm.stopPrank();
        weth.mint(maker, 1);
        vm.startPrank(taker);
        weth.approve(address(aqua), 100e18);
        aqua.push(maker, address(router), controller.orderHash(), S.WETH, 40e18);
        vm.stopPrank();
        vm.prank(maker);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        controller.resume();
        assertEq(controller.safetyDigest(), digest);
    }

    function test_OwnerRolloverDocksOldOrderAndInvalidatesHash() public {
        bytes memory oldData = data(true);
        bytes32 oldHash = controller.orderHash();
        CounterweightSwapVM oldRouter = router;
        vm.startPrank(maker);
        controller.pause();
        address[] memory tokens = new address[](2);
        tokens[0] = S.WETH;
        tokens[1] = S.USDC;
        aqua.dock(address(router), oldHash, tokens);
        vm.stopPrank();
        c.epochId = 2;
        c.priceMicroUsdc = 2000000001;
        setupEpoch(10e18, 20000e6);
        assertTrue(controller.orderHash() != oldHash);
        vm.expectRevert(CounterweightSwapVM.UnsupportedOrder.selector);
        oldRouter.quote(order, 1e17, oldData);
        vm.expectRevert(EpochController.VersionMismatch.selector);
        router.quote(order, 1e17, oldData);
        vm.startPrank(taker);
        weth.approve(address(router), 1e30);
        usdc.approve(address(router), 1e30);
        vm.stopPrank();
        fill(true, 1e17);
        assertInvariant();
    }

    function test_StaleInventoryQuoteCannotAuthorizeAnUnsafeFill() public {
        bytes memory old = router.takerData(true, 199400000, 1060);
        vm.startPrank(taker);
        weth.approve(address(aqua), 15e18);
        aqua.push(maker, address(router), controller.orderHash(), S.WETH, 10e18);
        vm.stopPrank();
        bytes32 beforeState = stateDigest();
        vm.prank(taker);
        vm.expectPartialRevert(TakerTraitsLib.TakerTraitsInsufficientMinOutputAmount.selector);
        router.swap(order, 1e17, old);
        assertEq(stateDigest(), beforeState);
        bytes32 hash_ = controller.orderHash();
        vm.prank(taker);
        aqua.push(maker, address(router), hash_, S.WETH, 5e18);
        beforeState = stateDigest();
        vm.prank(taker);
        vm.expectRevert(S.ExposureOutOfBounds.selector);
        router.swap(order, 1e17, old);
        assertEq(stateDigest(), beforeState);
    }

    function test_TransferReentryHitsUpstreamOrderLock() public {
        bytes memory d = data(true);
        weth.configureFault(address(0), address(router), abi.encodeCall(router.swap, (order, 1e17, d)));
        fill(true, 1e17);
        assertEq(weth.callbackFailure(), bytes4(keccak256("UnexpectedLock()")));
        assertInvariant();
    }

    function test_PhysicalPostBalanceEnvelopeIsAtomic() public {
        for (uint256 n; n < 2; n++) {
            bool w = n == 0;
            if (w) weth.mint(maker, 1e30 - weth.balanceOf(maker));
            else usdc.mint(maker, 1e30 - usdc.balanceOf(maker));
            bytes32 beforeState = stateDigest();
            bytes memory d = data(w);
            vm.prank(taker);
            vm.expectRevert(S.AmountOutOfRange.selector);
            router.swap(order, w ? 1e17 : 200e6, d);
            assertEq(stateDigest(), beforeState);
        }
    }

    function test_ActualPostBalanceMismatchRollsBackEverything() public {
        usdc.configureFault(maker, address(0), hex"");
        bytes32 beforeState = stateDigest();
        bytes memory d = data(false);
        vm.prank(taker);
        vm.expectRevert(CounterweightSwapVM.SettlementMismatch.selector);
        router.swap(order, 200e6, d);
        assertEq(stateDigest(), beforeState);
    }

    function testFuzz_SettlementPreservesInvariantAndConservation(uint64 raw, bool wethIn) public {
        uint256 amount = bound(raw, wethIn ? 1e12 : 1, wethIn ? 5e17 : 1e9);
        (uint256 w, uint256 u) = balances();
        uint256 takerW = weth.balanceOf(taker);
        uint256 takerU = usdc.balanceOf(taker);
        uint256 out = fill(wethIn, amount);
        assertGt(out, 0);
        assertInvariant();
        (uint256 postW, uint256 postU) = balances();
        assertEq(postW, wethIn ? w + amount : w - out);
        assertEq(postU, wethIn ? u - out : u + amount);
        assertEq(postW + weth.balanceOf(taker), w + takerW);
        assertEq(postU + usdc.balanceOf(taker), u + takerU);
    }
}
