# Counterweight: SwapVM and 1inch implementation

Verified against the repository implementation on September 12, 2026.

Counterweight implements a custom SwapVM router with two custom instructions and a small, reviewable patch to the pinned SwapVM base contract. It uses Aqua for strategy allocation accounting and actual token settlement. The custom logic combines inventory-seeking quotes with mandatory execution-time exposure checks.

Powered by SwapVM — © Degensoft Ltd 2025. See the retained [upstream license](../contracts/upstream/SwapVM-1.1.txt) and [modification notes](../contracts/upstream/README.md).

## What we use from 1inch

| Component | Use in Counterweight | Pinned dependency |
| --- | --- | --- |
| Aqua | Tracks inventory allocated to the maker/router/order; supplies `safeBalances`, allocation lifecycle, and settlement through `push`/`pull`. | `@1inch/aqua` commit `098b4c5d8eec67677f7ca861ca991af56024d9c5` |
| SwapVM | Supplies the VM execution context and loop, quote/swap entry points, order handling, transfer pipeline, and order-hash reentrancy lock. Counterweight implements its concrete dispatcher. | `@1inch/swap-vm` commit `f09a41e689240adc645934f965c8061749397cd2` |
| MakerTraits and TakerTraits | Upstream builders encode the strategy order and taker request; upstream parsing is used during execution. | Included in the pinned SwapVM package |
| Solidity utilities | Utilities used by the base contract, including WETH receiver handling and rescue functionality. | `@1inch/solidity-utils` version `6.9.10` |

Exact dependency declarations are in [package.json](../package.json). Our integration uses Aqua/SwapVM contracts directly; it does not route the demo through a 1inch aggregation API. Uniswap and SushiSwap are Graph observation sources in this workflow; settlement executes against Counterweight's allocated liquidity.

## What we built

| File | Responsibility |
| --- | --- |
| [CounterweightSwapVM.sol](../contracts/CounterweightSwapVM.sol) | Concrete router, custom instruction dispatcher, canonical request validation, and pre/post-settlement checks. |
| [QuoteMath.sol](../contracts/libraries/QuoteMath.sol) | Inventory-skewed exact-input pricing in both WETH/USDC directions. |
| [InventoryGuard.sol](../contracts/libraries/InventoryGuard.sol) | Allocation valuation, numerical bounds, physical backing, trade-size limits, and post-trade exposure enforcement. |
| [OrderCodec.sol](../contracts/libraries/OrderCodec.sol) | Canonical maker program and taker request using upstream builders. |
| [EpochController.sol](../contracts/EpochController.sol) | Fixed safety configuration for an epoch, bounded tuning, tuning versions, pause/resume, and router/order identity binding. |
| [Patched SwapVM base](../contracts/upstream/SwapVM.sol) | Mandatory validation and settlement extension points around upstream execution. |

## Do we change any opcodes?

We define two custom **SwapVM instruction codes** in our router's `_dispatch` implementation. These are not Ethereum/EVM opcode changes. We do not modify upstream standard instruction handlers or install instructions into an existing public router. The instruction meanings belong to the Counterweight router.

| Opcode | Arguments | Behavior |
| --- | --- | --- |
| `0xd0` | Eight-byte epoch ID | Guard wrapper: validates its position and epoch, checks input bounds, nonzero input, physical backing, and maximum trade size; runs the remaining program; then checks projected post-trade inventory. |
| `0xd1` | None | Calculates `amountOut` from current inventory, fixed epoch valuation, target allocation, and effective bounded tuning. |

The canonical program is exactly 12 bytes:

```text
d0 08 <8-byte epoch ID> d1 00
│  │                   │  └─ argument length: zero
│  └─ argument length: eight
└─ inventory guard     └─ inventory-skewed pricing
```

`OrderCodec` creates it as `abi.encodePacked(hex"d008", epoch, hex"d100")`. The first handler requires `nextPC == 10`; the second requires `nextPC == 12`. Unknown instructions revert.

The guard calls `ctx.runLoop()` to execute the pricing instruction, then checks the resulting output. This structure makes the guard wrap the quote calculation. The program is also bound by the complete canonical order hash, so callers cannot remove, reorder, replace, or append instructions to bypass it.

## How the pricing works

The pricing library values allocated WETH and USDC using the epoch's fixed reference price. It computes WETH weight in basis points, compares it with the target, and scales the difference by tuning intensity:

```text
skewBps = clamp((wethWeightBps - targetWethBps) × intensityBps / 10,000,
                -200, +200)
```

The implementation uses integer arithmetic and applies the resulting price shift plus a directional spread to calculate exact-input output amounts. When the maker holds excess WETH, the quotes encourage traders to buy WETH from the maker, reducing its WETH allocation. This encourages movement toward the target; it does not guarantee that traders will take those quotes.

Routine tuning permits intensity from 0–1,000 bps and spread from 10–100 bps. Missing or expired tuning falls back to zero intensity and a 100 bps spread. Graph observations influence only these bounded tuning fields. They cannot change exposure bounds, target, reference valuation, maximum trade size, or the program.

The demonstrated configuration uses a fixed 2,000 USDC/WETH valuation, a 50% WETH target, and 30–70% hard exposure bounds. These are demo configuration choices, not universal constants of SwapVM.

## What we patched in the SwapVM base

The complete diff is retained in [SwapVM.patch](../contracts/upstream/SwapVM.patch). Besides redirecting relative imports into the pinned package, it adds three abstract extension hooks and invokes them at mandatory points:

| Hook | Where it runs | Why it exists |
| --- | --- | --- |
| `_validateEntry` | At the beginning of both `quote` and `swap` | Enforces canonical order/request encoding, active epoch, tuning version, deadline, and positive minimum output. |
| `_beforeSettlement` | In `swap`, before VM execution | Captures the starting allocated inventory and physical maker balances; rejects native value. |
| `_afterSettlement` | After token transfers, before releasing the original lock | Verifies actual allocations and token deltas against the projection, rechecks backing, and enforces final exposure. |

The original transfer functions, order hashing, amount validation, and lock implementation remain unchanged. The patch provides mandatory safety checks around that existing machinery. A guard instruction alone would not provide the separate verification of actual post-transfer state.

## What happens during an actual swap

1. The router verifies the maker order against the controller's constructor-bound canonical hash and verifies the exact taker encoding.
2. It checks that the epoch is active, trading is unpaused, the tuning version matches, and the request deadline is valid.
3. The Aqua path supplies allocated balances. The router snapshots those allocations and the maker's physical WETH/USDC balances.
4. Opcode `0xd0` checks backing and trade size, invokes `0xd1` for current-inventory pricing, and checks projected exposure.
5. Upstream settlement executes the taker-first input transfer and Aqua accounting, followed by the maker's output transfer through Aqua.
6. Counterweight verifies that actual Aqua allocations equal the projection and actual maker token deltas equal the full input and quoted output.
7. It rechecks physical backing and exact post-trade exposure before the transaction completes. Any failure reverts the transaction atomically, including earlier token transfers.

Inventory is the allocation for this strategy, not the maker's entire wallet. Physical wallet balances must cover that allocation; insufficient backing is rejected rather than silently changing the accounting basis. Gas fees paid outside strategy accounting are excluded from unchanged-balance claims.

## Request restrictions and epoch control

The supported request uses exact-input/full-fill semantics, taker-first transfer, `transferFrom` plus `Aqua.push`, and the default recipient. Positive minimum output is mandatory. Alternative hooks, callbacks, direct-signature order mode, native-token/unwrap paths, changed flags, and trailing bytes are rejected by canonical encoding checks.

The instruction-argument envelope is the 96-byte ABI encoding of `(uint64 epoch, uint64 version, uint40 deadline)`. At validation, the deadline cannot be expired, more than 60 seconds ahead, or beyond epoch end. Quote-time calculation is advisory: execution calculates against current inventory again.

The controller binds the Aqua instance, router address, canonical order hash, and safety configuration. Changing safety configuration requires a new epoch/router/order. Bounded tuning updates and pause/resume increment the tuning version, invalidating requests carrying an older version.

On-chain controller methods authenticate the maker wallet address. Privy policies distinguish which authorized signer may cause that wallet to perform tuning, emergency pause, or owner recovery operations. The signer policy layer complements the on-chain inventory guard.

## What has been demonstrated

The [Phase 2 handoff](../planning/phase2/README.md) and [validation evidence](../planning/phase2/evidence/validation.md) document guarded Aqua/SwapVM settlement, including both trade directions, unsafe-exposure rejection, actual token/allocation deltas, and rollback after failed output transfer. The upstream source/patch validation procedure is also documented there.

The [integrated MVP evidence](../planning/phase5/evidence/validation.md) connects live Graph tuning and actual Privy operations with settlement and recovery. The September 11 terminal recording additionally ran a fresh integrated scenario with 97 recorded assertions and eight settlement attempts. Its local artifacts are under `artifacts/terminal-demo-2026-09-11/live/`; these are ignored working artifacts, not a durable tracked evidence dependency.

The demonstrated settlement environment is a local Ethereum fork, chain 31337, using canonical WETH and USDC. It does not establish public deployment or production readiness. Fee-on-transfer/rebasing tokens, arbitrary instruction programs, and additional fee programs are outside the supported strategy scope.

## Suggested demo explanation

“We built a custom SwapVM router with an inventory-skew pricing instruction and a hard inventory guard instruction. It uses Aqua's allocation accounting and real token settlement. We also added mandatory entry and post-settlement checks to the SwapVM base, so we verify the actual token outcome against the safety limits. Graph data can tune the quotes, but it cannot weaken those limits.”
