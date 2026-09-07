// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {SettlementFixture} from "../helpers/SettlementFixture.sol";
import {StrategyTypes as S} from "../../contracts/libraries/StrategyTypes.sol";
import {EpochController} from "../../contracts/EpochController.sol";
import {CounterweightSwapVM} from "../../contracts/CounterweightSwapVM.sol";
import {TakerTraitsLib} from "@1inch/swap-vm/src/libs/TakerTraits.sol";

contract SettlementTest is SettlementFixture {
    function test_RealAquaPipelineBothDirections() public {
        uint256 snap = vm.snapshotState();
        assertEq(quote(true, 1e17), 199400000);
        assertEq(fill(true, 1e17), 199400000);
        (uint256 w, uint256 u) = balances();
        assertEq(w, 101e17);
        assertEq(u, 19800600000);
        assertEq(weth.balanceOf(maker), w);
        assertEq(usdc.balanceOf(maker), u);
        assertEq(weth.balanceOf(taker), 100e18 - 1e17);
        assertEq(usdc.balanceOf(taker), 200000e6 + 199400000);
        assertInvariant();
        assertTrue(vm.revertToState(snap));
        assertEq(quote(false, 200e6), 99700897308075772);
        assertEq(fill(false, 200e6), 99700897308075772);
        (w, u) = balances();
        assertEq(w, 10e18 - 99700897308075772);
        assertEq(u, 20200e6);
        assertEq(weth.balanceOf(maker), w);
        assertEq(usdc.balanceOf(maker), u);
        assertEq(
            weth.balanceOf(address(router)) + usdc.balanceOf(address(router)) + weth.balanceOf(address(aqua))
                + usdc.balanceOf(address(aqua)),
            0
        );
        assertInvariant();
    }

    function test_UnsafeDirectSwapRevertsWithoutStateChanges() public {
        // Drive inventory near upper boundary through real fills; next fill must fail at guard.
        for (uint256 n; n < 15; n++) {
            bytes32 beforeState = stateDigest();
            bytes memory d = data(true);
            vm.prank(taker);
            try router.swap(order, 5e17, d) {
                assertInvariant();
            } catch (bytes memory reason) {
                assertEq(bytes4(reason), S.ExposureOutOfBounds.selector);
                assertEq(stateDigest(), beforeState);
                return;
            }
        }
        fail("expected upper exposure rejection");
    }

    function test_OutputTransferFailureRollsBackFirstInputAndAllowances() public {
        vm.prank(maker);
        usdc.approve(address(aqua), 0);
        bytes32 beforeState = stateDigest();
        bytes memory d = data(true);
        vm.prank(taker);
        vm.expectRevert();
        router.swap(order, 1e17, d);
        assertEq(stateDigest(), beforeState);
    }

    function test_ConsecutiveFillsRecomputeAndExternalPushChangesQuote() public {
        uint256 first = quote(true, 1e17);
        fill(true, 1e17);
        assertLt(quote(true, 1e17), first);
        vm.startPrank(taker);
        weth.approve(address(aqua), 1e18);
        aqua.push(maker, address(router), controller.orderHash(), S.WETH, 1e18);
        vm.stopPrank();
        assertLt(quote(true, 1e17), first);
        assertInvariant();
        vm.prank(maker);
        weth.transfer(address(55), 2e18);
        bytes memory d = data(true);
        vm.expectRevert(S.InventoryUnavailable.selector);
        router.quote(order, 1e17, d);
    }

    function test_TuningVersionPauseAndFallback() public {
        bytes memory old = data(true);
        bytes32 digest = controller.safetyDigest();
        uint64 version = controller.tuningVersion();
        vm.prank(maker);
        controller.setTuning(900, 28, version, 1100);
        vm.expectRevert(EpochController.VersionMismatch.selector);
        router.quote(order, 1e17, old);
        assertEq(quote(true, 1e17), 199440000);
        vm.warp(1100);
        assertEq(quote(true, 1e17), 199440000);
        vm.warp(1101);
        assertEq(quote(true, 1e17), 198000000);
        vm.prank(maker);
        controller.pause();
        bytes memory d = data(true);
        vm.expectRevert(EpochController.Paused.selector);
        router.quote(order, 1e17, d);
        vm.prank(taker);
        vm.expectRevert(EpochController.Unauthorized.selector);
        controller.resume();
        vm.prank(maker);
        controller.resume();
        assertEq(quote(true, 1e17), 198000000);
        assertEq(controller.safetyDigest(), digest);
    }

    function test_MissingGuardAndCallbackCannotBypassEntryValidation() public {
        bytes memory d = data(true);
        order.data = hex"";
        vm.expectRevert(CounterweightSwapVM.UnsupportedOrder.selector);
        router.quote(order, 1e17, d);
        vm.expectRevert(CounterweightSwapVM.UnsupportedOrder.selector);
        router.swap(order, 1e17, d);
        order = router.canonicalOrder();
        TakerTraitsLib.Args memory a;
        a.isExactIn = true;
        a.isFirstTransferFromTaker = true;
        a.useTransferFromAndAquaPush = true;
        a.threshold = abi.encode(uint256(1));
        a.deadline = 1060;
        a.instructionsArgs = abi.encode(c.epochId, controller.tuningVersion(), uint40(1060));
        a.hasPreTransferInCallback = true;
        d = TakerTraitsLib.build(a);
        vm.expectRevert(CounterweightSwapVM.UnsupportedTakerData.selector);
        router.swap(order, 1e17, d);
    }
}
