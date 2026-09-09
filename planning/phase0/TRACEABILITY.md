# Phase 0 traceability and handoff

This tracked ledger preserves the test requirements for a fresh clone. Commands labeled planned do not exist yet. PASS on P tests refers to planning/specification validation only. F1–F4 remain NOT RUN.

## Decision resolutions

Owner/reviewer for all decisions: root agent, 2026-09-06. Selections are controlled-MVP defaults under the Phase 0 task; they do not authorize funded production operations.

| ID | Selected resolution and rationale | Evidence / affected tests |
| --- | --- | --- |
| D01 | Strategy allocation with physical backing check; immutable USDC reference valuation for a 30-minute epoch | ACCOUNTING; P-02, S-05/06, V-03 |
| D02 | 50% target, 30–70% bounds, 1,000 USDC-equivalent input cap, immutable per epoch | ACCOUNTING + fixed examples; S-03/04 |
| D03 | Exact input, capped linear skew, spread in exchange rate, one output floor, no external fee | ACCOUNTING; S-01/02/04 |
| D04 | Strict in-bounds post-state including recovery trades; pause/dock/new epoch if restoration impossible | ACCOUNTING; S-05 |
| D05 | Pinned modified official SwapVM; entry validation plus guard wrapper/quote opcode and settlement post-check | INTEGRATIONS; source review + upstream 16 tests; V-01–06 |
| D06 | Original WETH/USDC on Ethereum fork, local chain 31337, fixed block and real transfer receipts | rpc-preflight + sponsor local-fork rule; V-07 |
| D07 | Messari Uniswap v3 and Sushi v3 Ethereum query IDs/pools, shared 4.0.x fields, per-run live CID pin | sources.json + source-validation; G-01/06 |
| D08 | Completed-hour activity/TVL mapping, two valid sources, finite TTL and on-chain fallback | DATA + graph fixtures; G-01–07 |
| D09 | Owner quorum, updater/emergency overrides, sign-only API and local raw broadcast; valid wrong-target denial | OPERATIONS + SDK typecheck/policy table; O-01–07 |
| D10 | Immutable safety/code per epoch; owner-only rollover/resume; pause/version/expiry for recovery | OPERATIONS + threat review; O-04/05/06 |
| D11 | 60-second reusable quotes, epoch+tuning version, exact-input minOutput, nonce-aware runner | ACCOUNTING; V-03/04, E-03 |
| D12 | Foundry/Node/Python pins, separate offline/fork/live jobs, concrete proof commands and manifests | PROOFS + lockfile/source/upstream checks; P-01/03, E-04/05 |
| D13 | ETHOnline 2026 inferred matching sponsor baseline; official eligibility and evidence requirements recorded | INTEGRATIONS; user may redirect event, triggering revalidation; P-03 |
| D14 | Tracked planning package for shared contracts; ignored local docs remain orchestration notes | planning/README; document link integrity, E-04 |

Rejected alternatives and limits: ACCOUNTING explains valuation/recovery choices; INTEGRATIONS rejects unrelated transfers, unstandardized Graph queries and assumed inheritance hooks; OPERATIONS distinguishes provider roles from on-chain maker identity and rejects revocation-as-retroactive-cancellation. No raw Graph input can change a hard field.

## Test ledger

Each row is a coverage requirement. When implementing, add actual test file/function, command, run revision and evidence link. Required S/V/G/O/E cases are not discharged by P0 tabletop models.

| ID | Required proof | Command / execution boundary | Evidence target | Status |
| --- | --- | --- | --- | --- |
| P-01 | Every D01–D13 decision is resolved with evidence and all F1–F3 proof procedures contain concrete inputs, identities, actions, assertions, and prerequisites. | Existing: python3 scripts/planning/validate_phase0.py; source/RPC commands in PROOFS | evidence/readiness.md | PASS |
| P-02 | Independently worked numeric examples cover both directions, target, each boundary, rounding, fees, and rejected execution. Review dimensional consistency. | Existing: python3 scripts/planning/validate_phase0.py; source/RPC commands in PROOFS | evidence/readiness.md | PASS |
| P-03 | Integration capability and sponsor qualification records cite authoritative sources and pinned versions; unsupported assumptions have an explicit investigation/result. | Existing: python3 scripts/planning/validate_phase0.py; source/RPC commands in PROOFS | evidence/readiness.md | PASS |
| P-04 | Permission matrix and minimal threat review map each applicable safety requirement to a test ID and enforcement location. | Existing: python3 scripts/planning/validate_phase0.py; source/RPC commands in PROOFS | evidence/readiness.md | PASS |
| S-01 | At target and on both sides of target, verify quote direction, spread, skew caps, positivity, and independently calculated amounts. Distinguish maker and taker benefit. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-02 | Cover trades moving toward target, away from target, and across/overshooting target according to the approved formula. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-03 | Accept/reject exactly at and immediately inside/outside each exposure and trade-size boundary; use the smallest representable unit where meaningful. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-04 | Test zero/near-zero inventory, zero/invalid amounts, selected token decimals, extreme supported values, precision loss, fee effects, and rounding. Reject invalid configuration and unsupported order modes. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-05 | Test approved behavior for already-outside-bounds inventory, valuation changes, external deposits/withdrawals, and insufficient available inventory. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-06 | Property test that every accepted projected settlement satisfies the formal invariant. Independently recompute post-trade exposure; include fees and rounding. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-07 | Across valid, missing, and adversarial regime inputs, verify immutable safety configuration and invariant enforcement. Same settlement inputs must yield the same guard decision regardless of data availability. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| S-08 | Stage E2E: invoke the prototype runner, load configuration/inventory, generate quote, apply guard, and report accepted/rejected projected balances. Include one successful and one failing case in each supported direction. Label as simulation, not F1. | `npm run test:strategy`; `npm run test:e2e`; `node scripts/proofs/prototype.mjs` | [P1 evidence and function mapping](../phase1/README.md) | PASS |
| V-01 | Execute custom strategy through pinned real interfaces; assert token identities, expected balance deltas, accounting, and configuration identity. Exercise both supported trade directions. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-02 | Unsafe execution fails specifically at the guard with unchanged token balances, allowances if touched, and relevant strategy state. Exclude external gas costs explicitly where applicable. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-03 | Change inventory between quote and execution and run consecutive fills; execution uses current state and cannot reuse an obsolete guard result. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-04 | Verify selected quote expiry/replay and configuration-transition rules. Include boundary times/versions and stale configuration. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-05 | Cause settlement failure after the execution path begins; verify rollback. Cover applicable callbacks/reentrancy and alternate entry points, or document concrete reasons they are outside the selected interface/token scope. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-06 | Stateful sequences of fills, configuration changes, and permitted external balance changes preserve the specified safety properties. Retain failing sequences and seeds. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| V-07 | Stage E2E/F1: setup -> fund/approve -> quote -> execute -> verify deltas -> unsafe attempt -> verify guard failure and unchanged state. Use the accepted real-token environment; save execution and failure evidence. | `npm run test:integration`; `npm run test:invariant`; `npm run test:fork`; `node scripts/proofs/f1.mjs` | [P2 evidence and function mapping](../phase2/README.md) | PASS |
| G-01 | Validate schema version, required fields/types, token and chain identity, token ordering, units, and normalization with independently known fixtures from both selected deployments. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-02 | Reject malformed, missing, partial, non-finite, overflowing, or extreme numeric values. Verify unknown/forbidden update fields cannot reach protected configuration. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-03 | Test source age and indexing lag separately from fetch time; exact freshness threshold, stale/future timestamps, and block/time inconsistencies. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-04 | Test timeout/rate-limit/provider failure, one-source failure, disagreement, startup without data, last-known-good expiration, retry limits, and recovery to valid data. Assert the approved fallback state and values. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-05 | Boundary/property tests for mapping caps and allowed fields; snapshot hard safety configuration before/after actual update handling, not only normalizer output. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-06 | Live queries from two distinct verified qualifying deployments produce validated normalized outputs with source metadata; retain queries, variables, and sanitized response evidence. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| G-07 | Stage E2E/F2: live query -> normalization -> bounded mapping -> strategy update -> observable quote effect or verified expected no-change -> safe fill -> unsafe-fill rejection. Exercise the existing SwapVM path and compare protected configuration before/after. Repeat with injected stale/malformed input to prove fallback. Clearly label any operations identity substitute before F3. | `npm run test:data`; `npm run test:live`; `node scripts/proofs/f2.mjs` | [P3 evidence](../phase3/evidence/validation.md) | PASS |
| O-01 | Validate the complete role/action matrix, including deployment/replacement, tuning, safety limits, transfers/approvals, pause/resume, operator/policy changes, and recovery. Every restriction has a positive or negative test as appropriate. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-02 | Actual allowed operation succeeds with the expected destination/method/chain and state effect. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-03 | A structurally valid forbidden operation is denied by the intended policy layer; collect denial identity/reason and unchanged protected state. Credential failure or an unrelated revert is not a substitute. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-04 | Cover wrong identity/destination/chain/method and amount limits where applicable; runtime operator attempts code replacement, approval widening, safety changes, and policy changes. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-05 | Test revocation and policy/configuration version changes, including the approved treatment of pending operations and outstanding quotes. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-06 | Pause blocks intended actions; authorized resume restores them; unauthorized resume fails. Ownership/recovery runbook is exercised in the controlled environment where supported. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| O-07 | Stage E2E/F3: real authorized organization-wallet action configures/operates the strategy -> successful guarded fill -> actual forbidden request denied -> unchanged protected state. Re-run Graph-to-strategy flow under the actual restricted identity. | `npm run test:operations`; `node scripts/proofs/f3.mjs` | [P4 final validation](../phase4/evidence/validation.md) | PASS |
| E-01 | Clean setup -> two live Graph reads -> normalized bounded tuning -> authorized update -> quote -> real SwapVM fill -> accounting assertion -> unsafe fill rejected -> forbidden policy action denied. All steps share traceable run/configuration identities. | Planned: mvp.mjs and independent reproduction | artifacts/<run-id>/mvp | NOT RUN |
| E-02 | Inject stale data and recover; change inventory between quote/fill; fail settlement; pause and resume; revoke operator. Assert expected state after each step. | Planned: mvp.mjs and independent reproduction | artifacts/<run-id>/mvp | NOT RUN |
| E-03 | Restart the runner/service; verify configuration provenance, freshness state, and duplicate/retry behavior do not cause unintended repeated operations. If no persistent service exists, test the equivalent rerun semantics. | Planned: mvp.mjs and independent reproduction | artifacts/<run-id>/mvp | NOT RUN |
| E-04 | Another agent follows the documented setup and reproduces gates without hidden local files. Compare assertions rather than volatile transaction IDs or market values. | Planned: mvp.mjs and independent reproduction | artifacts/<run-id>/mvp | NOT RUN |
| E-05 | Inspect artifacts/logs for missing identifiers and secrets; verify each gate links to exact commands and evidence and every required test has a recorded result. | Planned: mvp.mjs and independent reproduction | artifacts/<run-id>/mvp | NOT RUN |

## P0 handoff

- Package: P0-A through P0-D; owner root; technical contracts in planning/phase0, validation tooling in scripts/planning, local checklists synchronized in docs.
- Validation: offline exact arithmetic/data/policy review, pinned Graph schema and provider request type checks, read-only fork prerequisites, and isolated upstream accounting suite. See evidence/readiness.md and machine-readable outputs.
- Next eligible work: P1-A/P1-B only after the readiness audit records PASS. Implement exact-input quote/guard using the fixed fixtures and simulated stage E2E, then actual settlement in P2. Do not begin with UI or unbounded automation.
- Interfaces: ACCOUNTING formulas and 96-byte taker args; epoch-salted 12-byte program; controller setTuning/pause/resume contract; DATA normalized observations; OPERATIONS signer/policy templates.
- External prerequisites for later live phases: Graph query key; Privy app, independent owner quorum and signer keys; provisioned archive RPC if public fallback fails. These are not fictitious PASS results. Obtain approved account access through the owner; do not commit secrets.
- Scope limits: controlled static valuation, dedicated allocation rather than total treasury exposure, two-source availability required, Sushi registry dev status, local fork execution, no public-network deployment or profitability claim.
- Commit flow: accounting/fixtures; integration contracts and proof procedures; final validation/traceability and handoff. Use scoped future commits for each implementation package and test boundary.

## Phase 1 completion update

P1-A/P1-B and S-01–S-08 completed 2026-09-06 by root; [handoff and evidence](../phase1/README.md). Next eligible work is P2-A/P2-B. P0 handoff and its manifest describe the historical P0 revision; later status/command updates and the corrected arithmetic-product bound do not rewrite that historical evidence. F1–F4 remain NOT RUN.

## Phase 2 completion update

P2-A/P2-B, V-01–V-07 and F1 completed 2026-09-07 by root, committed using ginger-sesame; [handoff and clean-run evidence](../phase2/README.md). The accepted D06 mainnet fork ran actual canonical-token transactions. Next eligible package is Phase 3. F2–F4 remain NOT RUN. Historical P0/P1 status and manifests identify those original revisions; current regressions and source identities are recorded in P2 evidence.

## Phase 3 completion update

P3-A/P3-B, G-01–G-07 and F2 completed 2026-09-08 by root. [Handoff](../phase3/README.md), [D07/D08 revalidation](../phase3/SOURCE_REVIEW.md), and [clean evidence](../phase3/evidence/validation.md). F3/F4 remain NOT RUN; next eligible package is Phase 4. Prior phase sections describe historical statuses.

P4 checkpoint 2026-09-09: O-01–O-06 PASS with actual provider requests and fork effects; synthetic Graph excludes final O-07/F3. Latest live/clean proof still requires a qualifying current pair. [Validation](../phase4/evidence/validation.md).

P4 final acceptance 2026-09-09: P4-A/P4-B, O-01–O-07 and F3 PASS at runtime 49cd68b. D08 v2 (authorized demo adjustment) uses completed-day observations and hourly-equivalent turnover. Clean F1/F2/F3 and full deterministic regression pass; [final evidence](../phase4/evidence/validation.md) supersedes preceding blocked checkpoint. F4 remains NOT RUN.
