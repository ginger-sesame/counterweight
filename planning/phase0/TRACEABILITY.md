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
| S-01 | At target and on both sides of target, verify quote direction, spread, skew caps, positivity, and independently calculated amounts. Distinguish maker and taker benefit. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-02 | Cover trades moving toward target, away from target, and across/overshooting target according to the approved formula. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-03 | Accept/reject exactly at and immediately inside/outside each exposure and trade-size boundary; use the smallest representable unit where meaningful. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-04 | Test zero/near-zero inventory, zero/invalid amounts, selected token decimals, extreme supported values, precision loss, fee effects, and rounding. Reject invalid configuration and unsupported order modes. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-05 | Test approved behavior for already-outside-bounds inventory, valuation changes, external deposits/withdrawals, and insufficient available inventory. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-06 | Property test that every accepted projected settlement satisfies the formal invariant. Independently recompute post-trade exposure; include fees and rounding. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-07 | Across valid, missing, and adversarial regime inputs, verify immutable safety configuration and invariant enforcement. Same settlement inputs must yield the same guard decision regardless of data availability. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| S-08 | Stage E2E: invoke the prototype runner, load configuration/inventory, generate quote, apply guard, and report accepted/rejected projected balances. Include one successful and one failing case in each supported direction. Label as simulation, not F1. | Planned: forge strategy suite; S-08 prototype runner | artifacts/<run-id>/strategy | NOT RUN |
| V-01 | Execute custom strategy through pinned real interfaces; assert token identities, expected balance deltas, accounting, and configuration identity. Exercise both supported trade directions. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-02 | Unsafe execution fails specifically at the guard with unchanged token balances, allowances if touched, and relevant strategy state. Exclude external gas costs explicitly where applicable. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-03 | Change inventory between quote and execution and run consecutive fills; execution uses current state and cannot reuse an obsolete guard result. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-04 | Verify selected quote expiry/replay and configuration-transition rules. Include boundary times/versions and stale configuration. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-05 | Cause settlement failure after the execution path begins; verify rollback. Cover applicable callbacks/reentrancy and alternate entry points, or document concrete reasons they are outside the selected interface/token scope. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-06 | Stateful sequences of fills, configuration changes, and permitted external balance changes preserve the specified safety properties. Retain failing sequences and seeds. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| V-07 | Stage E2E/F1: setup -> fund/approve -> quote -> execute -> verify deltas -> unsafe attempt -> verify guard failure and unchanged state. Use the accepted real-token environment; save execution and failure evidence. | Planned: forge integration/invariant suites; V-07 f1.mjs | artifacts/<run-id>/f1 | NOT RUN |
| G-01 | Validate schema version, required fields/types, token and chain identity, token ordering, units, and normalization with independently known fixtures from both selected deployments. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-02 | Reject malformed, missing, partial, non-finite, overflowing, or extreme numeric values. Verify unknown/forbidden update fields cannot reach protected configuration. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-03 | Test source age and indexing lag separately from fetch time; exact freshness threshold, stale/future timestamps, and block/time inconsistencies. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-04 | Test timeout/rate-limit/provider failure, one-source failure, disagreement, startup without data, last-known-good expiration, retry limits, and recovery to valid data. Assert the approved fallback state and values. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-05 | Boundary/property tests for mapping caps and allowed fields; snapshot hard safety configuration before/after actual update handling, not only normalizer output. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-06 | Live queries from two distinct verified qualifying deployments produce validated normalized outputs with source metadata; retain queries, variables, and sanitized response evidence. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| G-07 | Stage E2E/F2: live query -> normalization -> bounded mapping -> strategy update -> observable quote effect or verified expected no-change -> safe fill -> unsafe-fill rejection. Exercise the existing SwapVM path and compare protected configuration before/after. Repeat with injected stale/malformed input to prove fallback. Clearly label any operations identity substitute before F3. | Planned: node data tests; G-06/07 f2.mjs | artifacts/<run-id>/f2 | NOT RUN |
| O-01 | Validate the complete role/action matrix, including deployment/replacement, tuning, safety limits, transfers/approvals, pause/resume, operator/policy changes, and recovery. Every restriction has a positive or negative test as appropriate. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-02 | Actual allowed operation succeeds with the expected destination/method/chain and state effect. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-03 | A structurally valid forbidden operation is denied by the intended policy layer; collect denial identity/reason and unchanged protected state. Credential failure or an unrelated revert is not a substitute. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-04 | Cover wrong identity/destination/chain/method and amount limits where applicable; runtime operator attempts code replacement, approval widening, safety changes, and policy changes. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-05 | Test revocation and policy/configuration version changes, including the approved treatment of pending operations and outstanding quotes. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-06 | Pause blocks intended actions; authorized resume restores them; unauthorized resume fails. Ownership/recovery runbook is exercised in the controlled environment where supported. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
| O-07 | Stage E2E/F3: real authorized organization-wallet action configures/operates the strategy -> successful guarded fill -> actual forbidden request denied -> unchanged protected state. Re-run Graph-to-strategy flow under the actual restricted identity. | Planned: node operations tests; actual F3 runner for provider assertions | artifacts/<run-id>/f3 | NOT RUN |
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
