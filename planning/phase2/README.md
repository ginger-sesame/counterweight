# Phase 2 handoff: guarded SwapVM settlement

Scope: P2-A/P2-B, F1 and V-01–V-07. Owner: root agent; commits use the locally authorized ginger-sesame identity. Read [ACCOUNTING](../phase0/ACCOUNTING.md), [integration contract](../phase0/INTEGRATIONS.md) and [proof procedures](../phase0/PROOFS.md) before changing behavior. [Validation evidence](evidence/validation.md) records the tested revisions and limitations.

## Deliverables and status

Check only after full coverage passes with retained evidence. Reopen affected items after source/configuration/dependency changes; preserve earlier evidence.

- [x] P2-A: exact SwapVM/Aqua pins, reviewed base patch, canonical custom guard/skew dispatcher, immutable epoch controller and actual post-settlement checks. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-01: both directions through pinned Aqua/SwapVM, fixed expected amounts, actual maker/taker deltas, allocation deltas, matching order/configuration identities and no retained router/Aqua assets. `SettlementTest.test_RealAquaPipelineBothDirections`; F1 safe branches. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-02: guard-specific direct-swap rejection with unchanged physical balances, allocations, allowances and controller state. `test_UnsafeDirectSwapRevertsWithoutStateChanges`; F1 upper/lower boundary branches with reverted transaction receipts and traces. Gas is outside WETH/USDC accounting. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-03: repeated fills, allocation changes after quote, physical shortfall, obsolete minOutput and unsafe execution against stale quoted inventory. `test_ConsecutiveFillsRecomputeAndExternalPushChangesQuote`, `test_StaleInventoryQuoteCannotAuthorizeAnUnsafeFill`, sequence handler. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-04: exact quote/epoch deadline boundaries, epoch/version mismatch, tuning updates/expiry/fallback, pause/resume and owner rollover/dock. `ValidationTest` deadline/tuning/rollover cases; `test_TuningVersionPauseAndFallback`. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-05: malformed/changed order/program/token/maker/traits, 15 unsupported flag mutations, callbacks/receiver/partial/native restrictions, missing/trailing arguments, threshold failures, order-lock reentry and actual post-balance mismatch. Physical post-balances must also remain within the supported numeric envelope; both directions have atomic rejection tests. Named tests in `ValidationTest`; output-transfer rollback in `SettlementTest` and F1. Token faults and reentry are adversarial local fixtures, not modifications to forked token code. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] V-06: 128 sequences × 32 actions with zero discarded/reverted handler calls; every accepted fill independently satisfies exposure bounds and every rejected fill preserves snapshots. Mix fills, pushes, physical donations/withdrawals, bounded tuning, pause/resume, clock changes, and owner pause/dock/new-price/new-epoch rollover. `test/invariant/Sequences.t.sol`; additional 1,000-case settlement conservation property in `ValidationTest`. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] P2-B / V-07 / F1: public CLI boots a fresh canonical-token fork, funds/approves/ships/deploys, quotes and broadcasts both safe directions, rejects both unsafe directions and demonstrates rollback after input transfer succeeds but output transfer fails. Capture five scenarios, receipts/events/traces, assertions, source/code hashes and branch identities. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).
- [x] Exit: deterministic and fork CLI tests, earlier regressions, clean reproduction, evidence audit, synchronized local/shared checklists and committed handoff. Completed: 2026-09-07; agent: root; evidence: [validation](evidence/validation.md).

## Reproduction

Use the pinned [root setup](../../README.md). No private keys or Graph/Privy credentials are needed. The funding and signed transactions are local to Anvil chain 31337. The upstream archive RPC supplies read-only Ethereum state at block 25917718.

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
python3 scripts/planning/validate_phase0.py
python3 scripts/planning/validate_upstream.py
forge fmt --check
npm test
npm run test:fork
node scripts/proofs/f1.mjs --out artifacts/my-f1-run
```

`npm test` runs strategy, settlement integration, stateful invariants and prototype CLI E2E. `npm run test:fork` runs the public F1 CLI on a fresh fork and tests nonlocal-RPC rejection. The final standalone command retains the proof. The output directory must be new; parents are created automatically. Existing evidence is never overwritten. A network/tool failure is a failed run, not a skipped PASS.

Default archive endpoint: `https://eth-mainnet.public.blastapi.io`; override with `ETHEREUM_RPC_URL` in the shell if needed. Do not commit key-bearing URLs. `.env` is not loaded automatically. `FORGE_BIN`/`ANVIL_BIN` may select explicit pinned executables. The runner owns and stops its child node on success/caught failure. SIGKILL cannot trigger cleanup; if a runner is forcibly killed, stop its orphaned local Anvil before rerunning.

The planned external-node form also works:

```sh
anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --fork-url "$ETHEREUM_RPC_URL" --fork-block-number 25917718
node scripts/proofs/f1.mjs --rpc http://127.0.0.1:8545 --out artifacts/external-f1-run
```

It requires a **fresh** fork at the pinned block and leaves that caller-owned node running. Stop/restart it before another proof. Preflight rejects non-loopback HTTP URLs, a non-31337 chain, missing Anvil fork metadata, a wrong block/hash, dirty local chain state, and wrong canonical token decimals before funding/signing. Do not substitute a mock-token node.

CI runs deterministic checks on push/PR. The separate 20-minute fork job is explicitly enabled with the `run_fork` workflow-dispatch input, using the optional repository `ETHEREUM_RPC_URL` secret or the public default. Hosted CI execution is not claimed by local results. Failure seeds/sequences in `cache/fuzz` and `cache/invariant` are uploaded along with logs. Default seed is `0xc0ffee`, 1,000 trials per property, and 128 invariant sequences of depth 32. Keep failing evidence when debugging; do not change fixed expectations to match a defect.

## Implementation and ABI contract

`contracts/upstream/SwapVM.sol` is the attributed pinned base with the complete [reviewable patch](../../contracts/upstream/SwapVM.patch). The original transfer functions remain unchanged. Both quote and swap perform mandatory entry validation. Swap captures pre-state before VM execution and checks actual state before releasing the original order-hash transient lock. `validate_upstream.py` verifies original source hash, dependency pins, exact patch and original license text.

`OrderCodec.order(maker,epochId)` uses the upstream maker builder: sorted USDC/WETH pair, Aqua mode, default receiver, no hooks, and exactly `d008 || uint64(epochId) || d100`. The guard wrapper runs the skew instruction once and checks the projected result. The entire order hash is constructor-bound, so empty/changed/reordered/extended programs and direct-signature orders fail before dispatch.

`OrderCodec.taker(wethIn,minOutput,epoch,version,deadline)` uses the upstream taker builder. Exact-input/full-fill, taker-first transfer, transferFrom+Aqua.push, default recipient, no hooks/callbacks/signature/native/unwrap, positive minOutput, and the 96-byte canonical `(uint64,uint64,uint40)` envelope are mandatory. `CounterweightSwapVM.canonicalOrder()` and `takerData()` expose these encodings to JS consumers. Validity is inclusive now/deadline/epoch end; quote validity cannot exceed 60 seconds or epoch end. Each execution recomputes current inventory and quote; replay does not bypass safety.

`EpochController(config,aqua,predictedRouter)` binds immutable config, canonical orderHash, Aqua and router identity. Deploy the controller followed immediately by its router using the same deployer; predict the router's next CREATE address. The router constructor verifies the binding. This constructor-only binding is a routine refinement of the Phase 0 interface: it allows `resume()` to inspect a fixed allocation without any registration setter. An incorrect prediction fails commissioning.

Controller starts paused with fallback intensity 0/spread 100. After approval and shipping, maker calls `resume()`, which checks epoch, backing and in-bounds allocation. `setTuning(uint16,uint16,uint64,uint40)` accepts only maker, bounded values, current version, and validity in `(now,min(now+300,epochEnd)]`; version increments atomically. Invalid updates revert. At `validUntil` tuning is still valid; after it, reads/execution compute fallback. `pause()` invalidates version; resume also increments it. Safety/price changes require a new epoch/router/order, with old epoch paused and both allocations docked first.

All owner-controlled methods currently authenticate the maker address. Privy later distinguishes updater/emergency/owner signing identities sharing that wallet. Phase 2 does **not** prove that distinction. Existing inherited router rescue/ownership methods are also outside the future updater allowlist; they do not provide a controller safety setter.

Inventory comes from `Aqua.safeBalances`; physical maker balances must cover it before execution. No `min(physical,allocated)` revaluation occurs. After upstream transferFrom/Aqua.push/pull, allocated post-state must equal projection and actual maker deltas must equal full input/quoted output, then physical backing/numerical envelopes and the exact guard are rechecked. Any failure rolls back the whole EVM transaction. Canonical WETH/USDC are the supported token semantics; fee-on-transfer/rebasing/native/extra fee programs remain unsupported.

## Evidence and next work

F1 emits `manifest.json`, `assertions.json`, `transactions.json` and `scenarios.json`. It records UTC time, source revision/hashes, chain/fork provenance, actor identities, constructor config, code hashes, canonical order/hash, successful/reverted transaction identities, receipt logs, before/after allocations/physical balances/allowances, and controller digest/version/pause state. The output-transfer failure also retains a call trace proving two successful WETH transferFrom calls preceded the failed USDC transferFrom; restored state proves atomic rollback.

Normal WETH and USDC successes use alternative snapshots of one epoch. Upper and lower failures use isolated epoch branches; reverted branch transaction receipts/traces are captured before resetting. Addresses may repeat across reverted branches, so correlate **branch + transaction + code/config identity**, not just address. These are five independently initialized scenarios, not a continuous operational history.

The initial funding is 10 WETH/20,000 USDC for maker and 1 WETH/5,000 USDC for taker. USDC comes from fork-only pool impersonation, which stops immediately afterward; WETH is minted via the canonical deposit method. The upper branch adds 4 WETH and allocates 14 WETH/12,000 USDC. The lower branch allocates 3 WETH/14,000 USDC from the reset funded baseline; excess physical inventory is deliberately excluded from the guarded allocation. No token code/storage is patched for F1.

Next eligible package is Phase 3: normalized live Graph observations from both qualifying deployments, bounded mapper/fallback handling and consumption via this controller followed by real guarded settlement. Read DATA and OPERATIONS before extending the worker/controller. Preserve S/V regressions and F1. F2–F4 remain NOT RUN; acquiring Graph access and Privy account/policy credentials is separate from the completed settlement proof. No public-network deployment, provider-policy proof or production-readiness claim is implied.
