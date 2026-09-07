// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {CounterweightSwapVM} from "../../contracts/CounterweightSwapVM.sol";
import {EpochController} from "../../contracts/EpochController.sol";
import {StrategyTypes as S} from "../../contracts/libraries/StrategyTypes.sol";
import {OrderCodec} from "../../contracts/libraries/OrderCodec.sol";

contract FixtureToken is ERC20 {
    constructor() ERC20("Fixture", "FIX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return address(this) == S.USDC ? 6 : 18;
    }
}

abstract contract SettlementFixture is Test {
    Aqua internal aqua;
    EpochController internal controller;
    CounterweightSwapVM internal router;
    ISwapVM.Order internal order;
    S.Config internal c;
    address internal maker = address(0x1111);
    address internal taker = address(0x2222);
    FixtureToken internal weth = FixtureToken(S.WETH);
    FixtureToken internal usdc = FixtureToken(S.USDC);

    function setUp() public virtual {
        vm.warp(1000);
        FixtureToken token = new FixtureToken();
        vm.etch(S.WETH, address(token).code);
        vm.etch(S.USDC, address(token).code);
        aqua = new Aqua();
        c = S.Config(S.WETH, S.USDC, maker, 1, 1000, 2800, 5000, 3000, 7000, 2e9, 1e9);
        setupEpoch(10e18, 20000e6);
        weth.mint(taker, 100e18);
        usdc.mint(taker, 200000e6);
        vm.startPrank(taker);
        weth.approve(address(router), 1e30);
        usdc.approve(address(router), 1e30);
        vm.stopPrank();
    }

    function setupEpoch(uint256 w, uint256 u) internal {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        controller = new EpochController(c, address(aqua), predicted);
        router = new CounterweightSwapVM(controller);
        assertEq(address(router), predicted);
        order = router.canonicalOrder();
        weth.mint(maker, w);
        usdc.mint(maker, u);
        address[] memory tokens = new address[](2);
        tokens[0] = S.WETH;
        tokens[1] = S.USDC;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = w;
        amounts[1] = u;
        vm.startPrank(maker);
        weth.approve(address(aqua), 1e30);
        usdc.approve(address(aqua), 1e30);
        assertEq(aqua.ship(address(router), abi.encode(order), tokens, amounts), controller.orderHash());
        controller.resume();
        controller.setTuning(1000, 30, controller.tuningVersion(), uint40(block.timestamp + 300));
        vm.stopPrank();
    }

    function data(bool wethIn) internal view returns (bytes memory) {
        return router.takerData(wethIn, 1, uint40(block.timestamp + 60));
    }

    function quote(bool wethIn, uint256 amount) internal returns (uint256 out) {
        bytes memory d = data(wethIn);
        vm.prank(taker);
        (, out,) = router.quote(order, amount, d);
    }

    function fill(bool wethIn, uint256 amount) internal returns (uint256 out) {
        bytes memory d = data(wethIn);
        vm.prank(taker);
        (, out,) = router.swap(order, amount, d);
    }

    function balances() internal view returns (uint256 w, uint256 u) {
        return aqua.safeBalances(maker, address(router), controller.orderHash(), S.WETH, S.USDC);
    }

    function stateDigest() internal view returns (bytes32) {
        (uint256 w, uint256 u) = balances();
        return keccak256(
            abi.encode(
                w,
                u,
                weth.balanceOf(maker),
                usdc.balanceOf(maker),
                weth.balanceOf(taker),
                usdc.balanceOf(taker),
                weth.balanceOf(address(router)),
                usdc.balanceOf(address(router)),
                weth.balanceOf(address(aqua)),
                usdc.balanceOf(address(aqua)),
                weth.allowance(maker, address(aqua)),
                usdc.allowance(maker, address(aqua)),
                weth.allowance(taker, address(router)),
                usdc.allowance(taker, address(router)),
                controller.tuningVersion(),
                controller.paused(),
                controller.safetyDigest()
            )
        );
    }

    function assertInvariant() internal view {
        (uint256 w, uint256 u) = balances();
        uint256 low = (3000 * u * 1e18 + 7000 * 2e9 - 1) / (7000 * 2e9);
        uint256 high = 7000 * u * 1e18 / (3000 * 2e9);
        assertGe(w, low);
        assertLe(w, high);
    }
}
