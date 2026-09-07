// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {SettlementFixture} from "../helpers/SettlementFixture.sol";
import {StrategyTypes as S} from "../../contracts/libraries/StrategyTypes.sol";
import {EpochController} from "../../contracts/EpochController.sol";

contract SequenceHandler is SettlementFixture {
    uint256 public accepted;
    uint256 public rejected;
    uint256 public actions;

    constructor() {
        setUp();
    }

    function action(uint256 entropy) external {
        actions++;
        uint256 choice = entropy % 9;
        uint256 value = entropy / 9;
        if (choice < 2) {
            bool w = choice == 0;
            uint256 amount = bound(value, w ? 1e12 : 1, w ? 5e17 : 1e9);
            bytes32 pre = stateDigest();
            bytes memory d = data(w);
            vm.prank(taker);
            try router.swap(order, amount, d) {
                accepted++;
                (uint256 postW, uint256 postU) = balances();
                uint256 den = 7000 * c.priceMicroUsdc;
                assertGe(postW, (3000 * postU * 1e18 + den - 1) / den);
                assertLe(postW, 7000 * postU * 1e18 / (3000 * c.priceMicroUsdc));
                assertEq(weth.balanceOf(address(router)) + usdc.balanceOf(address(router)), 0);
                assertEq(weth.balanceOf(address(aqua)) + usdc.balanceOf(address(aqua)), 0);
            } catch (bytes memory reason) {
                rejected++;
                assertEq(stateDigest(), pre);
                bytes4 selector = bytes4(reason);
                assertTrue(
                    selector == S.ExposureOutOfBounds.selector || selector == S.InventoryUnavailable.selector
                        || selector == S.EpochInactive.selector || selector == EpochController.Paused.selector
                        || selector == S.TradeTooLarge.selector || selector == S.InsufficientInventory.selector
                        || selector == S.ZeroOutput.selector
                );
            }
        } else if (choice == 2) {
            uint256 amount = bound(value, 0, 1e18);
            vm.startPrank(taker);
            weth.approve(address(aqua), amount);
            aqua.push(maker, address(router), controller.orderHash(), S.WETH, amount);
            vm.stopPrank();
        } else if (choice == 3) {
            uint256 amount = bound(value, 0, weth.balanceOf(maker) / 10);
            vm.prank(maker);
            weth.transfer(address(77), amount);
        } else if (choice == 4) {
            weth.mint(maker, bound(value, 0, 1e18)); // Physical-only replenishment/donation.
        } else if (choice == 5) {
            if (!controller.paused() && block.timestamp <= c.end) {
                uint40 until = uint40(block.timestamp + 300);
                if (until > c.end) until = c.end;
                if (until > block.timestamp) {
                    uint64 v = controller.tuningVersion();
                    bytes32 digest = controller.safetyDigest();
                    vm.prank(maker);
                    controller.setTuning(uint16(value % 1001), uint16(10 + (value / 1001) % 91), v, until);
                    assertEq(controller.safetyDigest(), digest);
                }
            }
        } else if (choice == 6) {
            if (!controller.paused()) {
                vm.prank(maker);
                controller.pause();
            } else {
                vm.prank(maker);
                try controller.resume() {}
                catch (bytes memory reason) {
                    bytes4 selector = bytes4(reason);
                    assertTrue(
                        selector == S.InventoryUnavailable.selector || selector == S.ExposureOutOfBounds.selector
                            || selector == S.EpochInactive.selector
                    );
                }
            }
        } else if (choice == 7) {
            vm.warp(block.timestamp + bound(value, 0, 400));
        } else {
            vm.startPrank(maker);
            controller.pause();
            address[] memory tokens = new address[](2);
            tokens[0] = S.WETH;
            tokens[1] = S.USDC;
            aqua.dock(address(router), controller.orderHash(), tokens);
            vm.stopPrank();
            c.epochId++;
            c.start = uint40(block.timestamp);
            c.end = c.start + 1800;
            c.priceMicroUsdc = 1e9 + value % 2e9;
            setupEpoch(10e18, 20000e6);
            vm.startPrank(taker);
            weth.approve(address(router), 1e30);
            usdc.approve(address(router), 1e30);
            vm.stopPrank();
        }
    }
}

contract SequenceInvariantTest is Test {
    SequenceHandler internal handler;

    function setUp() public {
        handler = new SequenceHandler();
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = handler.action.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_ActionsCheckEveryAcceptedAndRejectedSettlement() public view {
        assertLe(handler.accepted() + handler.rejected(), handler.actions());
    }
}
