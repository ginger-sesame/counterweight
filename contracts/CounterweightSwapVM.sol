// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;
import {SwapVM} from "./upstream/SwapVM.sol";
import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {Context, ContextLib} from "@1inch/swap-vm/src/libs/VM.sol";
import {TakerTraits, TakerTraitsLib} from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EpochController} from "./EpochController.sol";
import {StrategyTypes as S} from "./libraries/StrategyTypes.sol";
import {InventoryGuard as Guard} from "./libraries/InventoryGuard.sol";
import {QuoteMath} from "./libraries/QuoteMath.sol";
import {OrderCodec} from "./libraries/OrderCodec.sol";

contract CounterweightSwapVM is SwapVM {
    using ContextLib for Context;
    using TakerTraitsLib for TakerTraits;
    EpochController public immutable controller;
    error UnsupportedOrder();
    error UnsupportedTakerData();
    error InvalidEnvelope();
    error InvalidInstruction();
    error SettlementMismatch();

    constructor(EpochController controller_)
        SwapVM(address(controller_.aqua()), S.WETH, controller_.config().owner, "Counterweight", "1")
    {
        if (controller_.router() != address(this)) revert S.InvalidConfig();
        controller = controller_;
    }

    function canonicalOrder() external view returns (ISwapVM.Order memory) {
        S.Config memory c = controller.config();
        return OrderCodec.order(c.owner, c.epochId);
    }

    function takerData(bool wethIn, uint256 minOutput, uint40 deadline) external view returns (bytes memory) {
        return OrderCodec.taker(wethIn, minOutput, controller.config().epochId, controller.tuningVersion(), deadline);
    }

    function _validateEntry(ISwapVM.Order calldata order, uint256, bytes calldata data) internal view override {
        if (keccak256(abi.encode(order)) != controller.orderHash()) revert UnsupportedOrder();
        (TakerTraits traits, bytes calldata tail) = TakerTraitsLib.parse(data);
        bytes calldata envelope = traits.instructionsArgs(tail);
        if (envelope.length != 96) revert InvalidEnvelope();
        (uint64 epoch, uint64 version, uint40 deadline) = abi.decode(envelope, (uint64, uint64, uint40));
        (bool hasThreshold, uint256 minOutput) = traits.threshold(tail);
        if (
            !hasThreshold || minOutput == 0
                || keccak256(data) != keccak256(OrderCodec.taker(!traits.isAToB(), minOutput, epoch, version, deadline))
        ) revert UnsupportedTakerData();
        controller.requireActive();
        S.Config memory c = controller.config();
        if (epoch != c.epochId || version != controller.tuningVersion()) revert EpochController.VersionMismatch();
        if (deadline < block.timestamp || deadline > block.timestamp + 60 || deadline > c.end) {
            revert InvalidEnvelope();
        }
    }

    function _inventory(Context memory ctx) private view returns (S.Inventory memory i) {
        bool w = ctx.query.tokenIn == S.WETH;
        i = S.Inventory(
            w ? ctx.swap.balanceIn : ctx.swap.balanceOut,
            w ? ctx.swap.balanceOut : ctx.swap.balanceIn,
            IERC20(S.WETH).balanceOf(ctx.query.maker),
            IERC20(S.USDC).balanceOf(ctx.query.maker)
        );
    }

    function _dispatch(Context memory ctx, uint256 opcode, bytes calldata args) internal override {
        S.Config memory c = controller.config();
        bool w = ctx.query.tokenIn == S.WETH;
        if (opcode == 0xd0) {
            if (ctx.vm.nextPC != 10 || args.length != 8 || uint64(bytes8(args)) != c.epochId) {
                revert InvalidInstruction();
            }
            S.Inventory memory i = _inventory(ctx);
            Guard.checkAmount(ctx.swap.amountIn);
            if (ctx.swap.amountIn == 0) revert S.ZeroInput();
            Guard.checkBacking(i);
            Guard.checkSize(c, w, ctx.swap.amountIn);
            ctx.runLoop();
            Guard.project(c, i, w, ctx.swap.amountIn, ctx.swap.amountOut);
        } else if (opcode == 0xd1) {
            if (ctx.vm.nextPC != 12 || args.length != 0) revert InvalidInstruction();
            (ctx.swap.amountOut,,) =
                QuoteMath.calculate(c, _inventory(ctx), w, ctx.swap.amountIn, controller.effectiveTuning());
        } else {
            revert InvalidInstruction();
        }
    }

    function _beforeSettlement(Context memory ctx) internal view override returns (bytes memory) {
        if (msg.value != 0) revert UnexpectedMsgValue();
        return abi.encode(_inventory(ctx));
    }

    function _afterSettlement(Context memory ctx, bytes memory snapshot) internal view override {
        S.Inventory memory pre = abi.decode(snapshot, (S.Inventory));
        S.Config memory c = controller.config();
        bool w = ctx.query.tokenIn == S.WETH;
        (uint256 expectedW, uint256 expectedU) = Guard.project(c, pre, w, ctx.swap.amountIn, ctx.swap.amountOut);
        (uint256 actualW, uint256 actualU) =
            AQUA.safeBalances(c.owner, address(this), ctx.query.orderHash, S.WETH, S.USDC);
        if (
            actualW != expectedW || actualU != expectedU
                || IERC20(S.WETH).balanceOf(c.owner)
                    != (w ? pre.physicalWeth + ctx.swap.amountIn : pre.physicalWeth - ctx.swap.amountOut)
                || IERC20(S.USDC).balanceOf(c.owner)
                    != (w ? pre.physicalUsdc - ctx.swap.amountOut : pre.physicalUsdc + ctx.swap.amountIn)
        ) revert SettlementMismatch();
        Guard.checkPost(c, actualW, actualU);
    }
}
