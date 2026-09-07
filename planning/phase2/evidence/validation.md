# Phase 2 validation audit

Status: PASS — P2-A/P2-B, V-01–V-07 and F1 completed with clean reproduction. Agent: root, 2026-09-07. Final runtime/test revision: `66311d874bd6ffc02e64814ffe6a5571f6d8e21e`. Later completion-documentation changes do not alter that tested runtime. Exact source and artifact hashes are recorded in the validation manifest.

## Requirement-by-requirement evidence

| Requirement | Evidence / acceptance |
| --- | --- |
| P2-A pinned implementation | `upstream-check.log`; exact SwapVM/Aqua commits and dependency versions, unchanged original license, complete attributed hook diff. The modified base preserves upstream transfer logic. |
| V-01 correct settlement | `deterministic-tests.log`, `f1/scenarios.json`, `f1/transactions.json`; fixed quote outputs in both directions, successful swap receipts and Swapped events, actual maker/taker and allocation deltas, no router/Aqua retention. |
| V-02 atomic guard rejection | Two fork scenarios have status=reverted, ExposureOutOfBounds return data, discarded logs and identical before/after token, allocation, allowance and controller snapshots. Direct swap requests prove that bypassing the quote API does not bypass the guard. |
| V-03 current-state enforcement | Deterministic tests cover repeated fills, post-quote Aqua.push, physical shortfall, obsolete minOutput and a stale quote whose newly projected exposure is unsafe. Each swap recomputes current state. |
| V-04 configuration/quote lifecycle | Exact now/60-second/epoch-end boundaries, expiry, wrong epoch/version, tuning changes and fallback expiry, pause/resume and owner pause/dock/rollover. Startup is paused with fallback and cannot activate an unshipped allocation. |
| V-05 bypasses and settlement failure | All 15 unsupported flag mutations, altered maker/token/program/traits/hash, hook/callback/signature/recipient payloads, malformed/trailing envelopes, native/zero/threshold restrictions, order-lock reentry, actual post-balance mismatch and numerical-envelope failures. Fork output-failure trace shows two successful WETH transferFrom calls before failed USDC transferFrom; final state is fully restored. |
| V-06 sequences and independent invariants | 128 sequences of depth 32 (4,096 actions), zero handler reverts/discards; assertions inside the action verify accepted exposure and rejected-state preservation. Actions include both fills, allocation pushes, physical donations/withdrawals, bounded tuning, pause/resume, time and new-price/epoch rollover. An additional 1,000-case settlement property checks conservation and the independent allowable-WETH interval. |
| P2-B / V-07 / F1 public E2E | `fork-tests.log` invokes the actual public runner on a fresh canonical-token fork and tests nonlocal-RPC rejection before transactions. Separate `f1/` artifacts retain five accepted/rejected/rollback scenarios through the same compiled router and controller. |
| Earlier regressions | `deterministic-tests.log` includes the 14 original strategy tests/3,000 property cases and five prototype CLI test groups. `prototype.json` retains the 24-scenario simulated report. Phase 0 fixture/package checks pass in `planning-check.log`. |
| Reproducibility/tooling | `setup.log`, `format.log`; archive of the committed final source, fresh npm install, checksum-verified Foundry download, compiler build, all documented checks. No ignored docs, environment files, prior node_modules/build outputs or Git metadata were present in the archive. |
| CI and handoff | Deterministic push/PR job and explicit fork workflow-dispatch job, logs and failure-seed retention, tracked ABI/setup/evidence guide and synchronized local/shared checklists. Hosted CI execution is not claimed. |

The [handoff checklist](../README.md) maps named functions and commands to these coverage IDs. No required case is skipped. The final deterministic total is 34 Solidity tests (14 strategy, 19 integration, one stateful invariant), 4,000 property trials, 4,096 stateful actions, and five prototype CLI test groups. The separate fork suite has two test groups. Property testing supplements fixed independent examples; it is not an exhaustive proof of all possible EVM behavior.

## Findings resolved during validation

`initial-format-check.log` preserves the first clean-setup formatting failure. The pinned formatter required another transformation of a long return expression; simplifying the helper expression made formatting stable. Contract behavior was unaffected.

`physical-envelope-regression-before.log` preserves a deliberately added regression test that failed on the previous router: physical balances were checked before settlement but their post-state numerical envelope was not enforced. The final router checks actual post-state backing/envelopes after validating deltas. Both token directions now reject overflow beyond 10^30 base units atomically. The accepted accounting envelope and hard exposure bounds were not relaxed.

## Evidence interpretation and limits

F1 uses the Phase 0 accepted environment: mainnet fork block 25917718, local chain 31337, canonical WETH/USDC bytecode and broadcast local transactions. This is not a mock-token substitute or a public-network deployment. Local fault/reentry tokens are used only by deterministic adversarial tests. The canonical-token proof never patches token code/storage.

Snapshot branches are isolated scenarios. Correlate branch, transaction and code/config hashes; identical addresses can represent different constructor state across restored snapshots. Receipts and traces are captured before resetting a branch. These branches do not claim one uninterrupted operational history.

The clean archive lacks `.git`, so runner revision fields are null. Its source/lockfile hashes match the committed final implementation; the enclosing validation manifest names that revision and archive tree. Historical Phase 0/1 manifests retain their original hashes and status. Their relevant tests were rerun with Phase 2's dependency/configuration changes; old manifests are not rewritten to pretend they describe this revision.

The inherited router owner/rescue surface does not change controller safety configuration. Privy must still prove signer restrictions for the shared maker identity in Phase 4. Graph normalization/live inputs, provider-policy enforcement and the integrated MVP remain F2–F4 NOT RUN. The fork proof does not establish production readiness.

Retained artifacts use only public local test identities and configuration, unsigned ABI calldata, receipt/trace data and transaction hashes. They exclude account keys, authorization headers, key-bearing RPC URLs and raw signed transactions. Funding is fork-only; runner-owned nodes are stopped after each run.
