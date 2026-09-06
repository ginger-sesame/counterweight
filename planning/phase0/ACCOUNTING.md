# Accounting and quote contract — version 1

Decision owner/reviewer: root agent, 2026-09-06, under the user's Phase 0 implementation request. Parameters below are selected controlled-MVP defaults, not a recommendation for deploying treasury capital. Safety constraints from PRODUCT_SPEC remain unchanged.

## D01: inventory and valuation

The guarded inventory is one active Aqua `(maker, app, strategyHash)` allocation containing exactly WETH and USDC. Do not claim to guard all organization assets. `safeBalances` supplies allocation amounts; additionally read actual maker ERC-20 balances and require each actual balance >= its allocation before executing. Do not use `min(actual, allocated)` as an exposure definition: that silently changes the portfolio being guarded. Other Aqua strategies may compete for physical assets; MVP uses a dedicated maker and one active Counterweight order.

Let `W` be WETH wei (18 decimals), `U` be USDC base units (6 decimals), and `P` be micro-USDC per whole WETH. The controlled epoch uses `P = 2_000_000_000` (2,000 USDC/WETH). USD peg assumptions are not needed: the accounting numeraire is USDC, not USD.

Use exact scaled values `A = W * P`, `B = U * 10^18`, `T = A + B`. WETH exposure is `A/T`; USDC exposure is its complement. Reject T=0. Guard comparisons use cross multiplication, never a rounded displayed percentage. Graph USD liquidity statistics are regime inputs only and cannot set P.

P is an immutable owner-approved price for a bounded experiment epoch, not a live market oracle. Epoch lifetime is 1,800 seconds; require `start <= block.timestamp <= end` and end-start <= 1,800. Expired valuation rejects quotes and trades. No runtime renewal. Owner creates a new epoch/order after pause/dock with new approved price and fresh inventory. This makes the accounting basis explicit and reproducible; it does not protect against market-price drift during the epoch. A production oracle design is out of scope.

Alternative rejected: live Graph price for exposure, because it would let the tuning data change effective safety valuation. Raw-balance allocation was rejected because unlike units cannot be added directly.

## D02: safety configuration

| Field | Value / validity |
| --- | --- |
| targetWethBps | 5,000 |
| minWethBps / maxWethBps | 3,000 / 7,000 inclusive |
| minUsdcBps / maxUsdcBps | Derived: 3,000 / 7,000; no independent setters |
| maxInputValueMicroUsdc | 1,000,000,000 (1,000 USDC equivalent) |
| epoch reference price | P above; allowed construction range 1 through 10^12 |
| starting normal inventory | 10 * 10^18 WETH wei, 20,000 * 10^6 USDC units |
| supported numerical envelope | Each balance/input/post-balance <= 10^30 base units |
| owner changes | New immutable epoch; no in-place safety/price/target setter |

Require `0 < min < target < max < 10_000`, positive price and size (size <=10^30 micro-USDC), valid epoch times, exact token pair, nonzero authority addresses, and a distinct token pair. Runtime tuning can never change these fields. Enforce envelope bounds before arithmetic; maximum product used for guard comparisons is below 10^47, safely below uint256 capacity. WETH-output quote numerator is bounded below 10^56. No unchecked arithmetic.

The input-size test is exact: WETH input `input * P <= maxInputValueMicroUsdc * 10^18`; USDC input `input <= maxInputValueMicroUsdc`. The cap is per execution, not a daily risk budget.

## D03: exact-input quote math

Only exact-input swaps, in both directions; exact-output, partial fills, native ETH, fee-on-transfer/rebasing tokens, and additional fee opcodes are unsupported and rejected. Maker receives the full input. Spread is retained in the exchange rate; there is no extra transfer fee or protocol fee in MVP.

`D = 10_000`. For quote computation only, `wBps = floor(D*A/T)`.

`k = clamp(truncTowardZero((wBps-targetWethBps)*intensityBps / D), -200, 200)`.

Signed division truncates toward zero (not Python floor for negative values). `intensityBps` is 0..1,000; `spreadBps` is 10..100. Default intensity=1,000, spread=30. Positive k means excess WETH; both bid and ask shift down. Price units are USDC per WETH, from maker perspective:

- Maker bid (taker sells WETH): `P*(D-k)*(D-spread)/D^2` micro-USDC per WETH.
- Maker ask (taker buys WETH): `P*(D-k)*(D+spread)/D^2` micro-USDC per WETH.
- WETH input: `outUSDC = floor(inputWETH * P * (D-k) * (D-spread) / (10^18 * D^2))`.
- USDC input: `outWETH = floor(inputUSDC * 10^18 * D^2 / (P * (D-k) * (D+spread)))`.

Do not round the intermediate price. Round output down once, favoring maker. Reject output=0 and output exceeding allocated/physical funds. Apply post-state: input token allocation increases by full input; output allocation decreases by output. The exposure invariant is `minWethBps*Tpost <= D*Apost <= maxWethBps*Tpost`.

Skew is evaluated from pre-trade inventory; crossing target does not cause intra-fill repricing. Overshoot still faces the hard guard and size cap. Quote attractiveness means relative to the same spread with k=0, not a guarantee of better pricing than another venue or positive profit.

## D04: outside-bounds and recovery

Strict post-state rule: starting outside bounds does not itself authorize a bypass. A fill is allowed only if it finishes inside bounds and satisfies every other check. A fill that improves exposure but remains outside is rejected. If the size cap prevents full recovery, pause/dock and use owner-approved recovery/new epoch. Do not add a reduce-only exception.

Plain deposits increase physical balances only, not the Aqua allocation. `Aqua.push` changes both; a changed allocation is read on the next execution. Withdrawals/competing strategies may make physical balances insufficient: fail with InventoryUnavailable rather than revalue the allocation. Owner withdrawals require pausing and docking first in the runbook. These external actions are not fills covered by the post-trade invariant.

## D11: quotes, versions, replay

Quote envelopes contain chain, router, maker, orderHash, epochId, tuningVersion, validUntil, direction, input, and minOutput. Taker instruction args encode `(uint64 epochId,uint64 tuningVersion,uint40 validUntil)` with canonical ABI encoding (96 bytes); reject malformed/trailing data. `now <= validUntil <= now+60` and `validUntil <= epochEnd`; selected values bind execution to current epoch and tuning version. Quote generation is read-only; it issues no signed authority.

A successful fill does not consume the entire Aqua position. Repeating a quote is permitted only while current-state recomputation, version, expiry, minOutput, and guard checks still pass. It is a reusable market quote, not a single-use payment authorization. Ethereum transaction nonce prevents retransmitting the same signed transaction as a new execution. Rerun tooling never signs a duplicate operation blindly; reconcile transaction hash/nonce first.

A tuning update increments tuningVersion and invalidates older envelopes. Pause increments version; resume is owner-only, checks fresh epoch and valid inventory, and increments version again. Owner safety/price changes require a new epoch and order hash, after disabling the previous one. No fallback to old configuration on version mismatch.

## Deterministic rejection order

Implement checks in this order so negative proof cases have interpretable reasons: canonical order/trait/argument validation -> expected epoch/version and pause/expiry checks -> numerical envelope and nonzero input -> physical backing -> exact input-size cap -> quote computation -> nonzero output and sufficient allocated output -> exact post-exposure guard -> settlement -> actual post-balance assertions. Constructor configuration validation precedes activation. Multi-fault cases must not be used to prove a later boundary; isolate the intended guard with all earlier checks satisfied.

## Validation oracle

`fixtures/accounting.json` contains independently reviewable fixed examples. `scripts/planning/validate_phase0.py` checks their exact rational outputs, post-state, boundary classifications, and dimensional relationships; it is specification validation, not strategy application code or a substitute for S/V tests. Arithmetic examples use P=2,000 solely for reproducibility. `evidence/accounting-review.md` records the manual derivation and run coverage.
