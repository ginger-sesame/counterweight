// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {MakerTraitsLib} from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import {TakerTraitsLib} from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import {StrategyTypes as S} from "./StrategyTypes.sol";

library OrderCodec {
    function order(address maker, uint64 epoch) internal pure returns (ISwapVM.Order memory) {
        MakerTraitsLib.Args memory a;
        a.maker = maker;
        a.tokenA = S.USDC;
        a.tokenB = S.WETH;
        a.useAquaInsteadOfSignature = true;
        a.program = abi.encodePacked(hex"d008", epoch, hex"d100");
        return MakerTraitsLib.build(a);
    }

    function taker(bool wethIn, uint256 minOutput, uint64 epoch, uint64 version, uint40 deadline)
        internal
        pure
        returns (bytes memory)
    {
        TakerTraitsLib.Args memory a;
        a.isExactIn = true;
        a.isFirstTransferFromTaker = true;
        a.useTransferFromAndAquaPush = true;
        a.isAToB = !wethIn;
        a.threshold = abi.encode(minOutput);
        a.deadline = deadline;
        a.instructionsArgs = abi.encode(epoch, version, deadline);
        return TakerTraitsLib.build(a);
    }
}
