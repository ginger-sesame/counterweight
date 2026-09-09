# Phase 4 validation checkpoint — BLOCKED on live data

Recorded 2026-09-09 by root. Runtime checkpoint `bd1968b`; source digests are in [provenance](checkpoint/provenance.json). This record deliberately does not claim full Phase 4 or F4 completion.

## Proven operations coverage

The [full matrix diagnostic](checkpoint/matrix-diagnostic/failure.json) completed 151 named passing assertions and three settlement scenarios. It intentionally finishes FAIL with `Diagnostic completed; synthetic Graph input cannot pass F3`. Only Graph observations are substituted; actual Privy owner/updater/emergency requests, canonical-token fork settlement, policy/authorization denials and recovery are real. [Audit](checkpoint/audit.json) verifies 52 intended denials, 38 validated-signature records, state equality, named revert selectors, restored owner keys and restored restricted signer enrollment.

| Coverage | Result and authoritative evidence |
| --- | --- |
| O-01 role/action matrix | PASS: owner deploys, funds, approves, ships, tunes, pauses, docks and transfers recovery funds; updater can tune within bounds; emergency can pause. Restricted identities cannot deploy, dock, transfer, approve, resume or administer resources. Single-owner/runtime authorization fails. Owner cannot bypass immutable controller bounds. |
| O-02 allowed operation | PASS: actual provider-signed bounded update is broadcast on chain 31337, changes tuning/version and preserves full immutable configuration/digest. Exact allowed intensity/spread boundaries are also signed. |
| O-03 intended policy denial | PASS: second controller is initialized for the same maker and valid request succeeds in on-chain simulation, then updater signing returns policy_violation. Retained attempted request and before/after chain state establish the intended boundary. |
| O-04 identities/targets/methods/amounts | PASS: wrong chain/target, nonzero native value, deployment, approvals, transfer, pause/resume, dock and oversized tuning denied for applicable roles. Personal, typed, raw, 7702, provider-broadcast, user-operation, batch and export methods denied. Owner commissioning value above 20 ETH denied. Actual policy/authorization failures are distinguished. |
| O-05 revocation/version/rotation | PASS: revoked updater cannot obtain a new signature; a previously signed update reverts at Paused; another reverts at VersionMismatch after resume. Rotation excludes old C, admits replacement with A, then restores A/B/C. Retargeted policy rejects old controller. Receipt reconciliation produces no duplicate broadcast/nonce increment. |
| O-06 pause/resume/recovery | PASS: pause blocks quotes/fills, emergency resume is denied, owner resume and a new update succeed. Owner pause/dock/recovery transfer succeeds. Both raw Aqua allocations are zero with docked marker 255; the active-only balance API correctly rejects docked liquidity. |
| O-07 / final F3 | BLOCKED on current live data: historical live F3 passed at the source hashes in its own manifest, but the latest full matrix still requires fresh live Graph and clean F3 CLI/retained proofs. Synthetic Graph cannot satisfy this row. |

The matrix [operation records](checkpoint/matrix-diagnostic/privy-operations.json), [signature records](checkpoint/matrix-diagnostic/privy-signatures.json), [pending-operation traces](checkpoint/matrix-diagnostic/privy-recovery-traces.json), and initial/final Privy configuration snapshots identify the enforced controls. HTTP correlation IDs may be Cloudflare cf-ray values; they are not falsely labeled provider transaction IDs. Sign-only requests are identified by their signed transaction hash; raw signed bytes and private authorization material are not retained.

All positive signing and token settlement uses the disposable canonical-token fork, chain 31337. Batched-call preparation requires a provider-supported network: its negative tests use chain 11155111 with zero native balance, zero-value self-calls and sponsor:false. Both roles receive policy_violation; public testnet balance and pending nonce are unchanged. No public-network transaction/deployment is claimed or required. All owner keys remain in one development environment, so independent administrator custody is not proved.

## Regression and reproduction

Fresh clone `/tmp/counterweight-p4-clean-tGCgWP` installed locked dependencies and verified Foundry without copying node_modules/build output/secrets. This disposable path is not a prerequisite; use the [handoff commands](../README.md) with external approved credential files. Clean deterministic regression ran at de3ace0; subsequent commits changed only F3/method probes, their live semantic test and handoff docs, leaving the passing deterministic implementation unchanged.

- [Clean setup](checkpoint/clean-setup.log): npm ci and verified Foundry installation PASS.
- [Clean deterministic](checkpoint/clean-deterministic.log): 35 Solidity tests, 5,000 fuzz examples, 128 stateful runs / 4,096 actions; five prototype CLI groups, 15 data groups including 10,001 mapper inputs, eight operations groups; all PASS, no skips.
- [F1 regression](checkpoint/f1.log): two canonical-token fork CLI groups PASS, also PASS in the [clean combined run](checkpoint/clean-fork-live.log).
- [F2 regression](checkpoint/f2.log): live public CLI PASS before the hourly source gap. The later clean F2 attempt correctly failed missing completed-hour data; it is not a clean live PASS.
- [Planning checks](checkpoint/planning.log) and [pinned upstream check](checkpoint/upstream.log): PASS.
- Clean actual-provider full matrix at bd1968b: [retained diagnostic](checkpoint/clean-matrix-diagnostic/failure.json) again completes 151 assertions and 52 expected denials, then intentionally fails the synthetic-Graph checkpoint. External approved env/key/journal paths were used; no credentials copied into the checkout.
- Latest live F3/clean F3 CLI: still required. Do not count the older [historical live proof](checkpoint/historical-live-f3/manifest.json) as validation of the latest runtime revision. It had 123 passing assertions and three scenarios with three fresh two-source collections.

## Remaining external prerequisite and next action

The latest [Graph collection](checkpoint/latest-graph-unavailable/collection.json) lacks the required completed-hour Sushi entity. The [hour-history investigation](checkpoint/sushi-hours.json) shows event-driven gaps despite fresh indexing metadata. No older hour, inferred zero-volume record, backdated wall clock or alternative pool is accepted. Retry the documented Graph preflight; only when both current sources qualify run the latest live F2/F3 CLI tests and retain a standalone F3 proof from the clean checkout.

After those pass, independently recompute live mapping, inspect receipts/state/denials and source hashes, rescan all final artifacts for secrets, verify restored remote ownership/signers, and synchronize O-07 and Phase 4 exit checkboxes. Hosted CI remains configured but not executed. F4 is separate work.

Blocked audit, 2026-09-09 04:30 UTC: fresh preflight again found Uniswap hour 496923 present and Sushi hour 496923 absent. The same live-data prerequisite has persisted across three consecutive goal turns. Independent implementation, actual-provider matrix, clean diagnostic reproduction, artifact audit, documentation and commits are complete; remaining latest live F2/F3 acceptance and final evidence audit require an external data-state change. No missing user credential or additional permission is needed.
