# Phase 4 validation — PASS

Completed 2026-09-09 by root. P4-A/P4-B, O-01–O-07 and F3 pass in the accepted environment. F4 remains NOT RUN; this is not a production deployment or independent administrator custody claim.

Validated runtime revision: `49cd68bad293bccf092550eaf59d90373c1199f7`. The clean checkout `/tmp/counterweight-p4-clean-tGCgWP` installed locked dependencies and verified Foundry, then advanced to this revision. No node_modules, build output, .env or key bundle was copied into that checkout. Approved credentials and the authoritative Privy journal were injected through explicit external paths. Final documentation/evidence commits do not change the validated runtime.

## Accepted demo adjustment

The user authorized adapting the demo while retaining its main goals. [D08 v2](../DAILY_REGIME.md) replaces the last completed hour with the last completed UTC day for both original Graph deployments. Daily volume divided by 24 gives average hourly turnover relative to recorded liquidity; this is explicitly a slower activity signal. Normalized schema is counterweight.regime.v2 with windowStart/windowEnd/windowSeconds. Indexing/fetch freshness, two-source qualification, RPC token identity, disagreement threshold, bounded mapping, 300-second tuning expiry, Privy restrictions and immutable inventory limits are preserved. Missing daily records still reject; no synthetic zeros or old-period fallback passes the live gate.

## Clean validation and evidence

All paths below are under [final/](final/).

| Command / proof | Result / evidence |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund`; verified Foundry install | PASS; setup.log. Exact dependency/tool versions also in F3 manifest. |
| `npm test` | PASS; deterministic.log. 35 Solidity tests, 5,000 fuzz examples, 128 stateful sequences / 4,096 actions, five prototype CLI groups, 17 data groups, eight operations groups; no skips. |
| `node --test test/fork/*.test.mjs test/live/*.test.mjs` | PASS; fork-live-tests.log. Two F1 groups and live F2 public CLI. |
| `node scripts/proofs/f2.mjs --out <fresh>` | PASS; f2/manifest.json: 82 assertions, four settlement scenarios, three live source pairs, stale/malformed injections, fallback and recovery. |
| `node --test test/privy/*.test.mjs` | PASS; privy-tests.log. Actual full F3 CLI and semantic artifact checks from clean checkout. |
| `node scripts/proofs/f3.mjs --out <fresh>` | PASS; f3/manifest.json: **157 assertions, three settlement scenarios, 52 intended denials, 38 validated signatures and three live source pairs**. |
| `forge fmt --check`; planning/upstream validators | PASS; format.log, planning.log, upstream.log. |
| `npm ci --prefix scripts/planning`; pinned source/SDK validation | PASS; source-setup.log, source-validation.json. Daily GraphQL fields checked against pinned source schema; Privy SDK/ABI policies remain pinned. |

Live commands used Node's external `--env-file` and PRIVY_KEYS_FILE/PRIVY_RESOURCES_FILE. Foundry was on PATH. Runs sharing the Privy wallet were serialized. [Handoff](../README.md) provides reproduction commands; exact source hashes, revisions, tool/dependency identities and chain/pool/controller IDs are retained in both manifests.

## Requirement mapping

| Coverage | Result and authoritative evidence |
| --- | --- |
| O-01 role/action matrix | PASS: owner deploys, funds, approves, ships, tunes, pauses, docks and transfers recovery funds; updater can tune within bounds; emergency can pause. Restricted identities cannot deploy, dock, transfer, approve, resume or administer resources. Single-owner/runtime authorization fails. Owner cannot bypass immutable controller bounds. |
| O-02 allowed operation | PASS: actual provider-signed bounded update is broadcast on chain 31337, changes tuning/version and preserves full immutable configuration/digest. Exact allowed intensity/spread boundaries are also signed. |
| O-03 intended policy denial | PASS: second controller is initialized for the same maker and valid request succeeds in on-chain simulation, then updater signing returns policy_violation. Retained attempted request and before/after chain state establish the intended boundary. |
| O-04 identities/targets/methods/amounts | PASS: wrong chain/target, nonzero native value, deployment, approvals, transfer, pause/resume, dock and oversized tuning denied for applicable roles. Personal, typed, raw, 7702, provider-broadcast, user-operation, batch and export methods denied. Owner commissioning value above 20 ETH denied. Actual policy/authorization failures are distinguished. |
| O-05 revocation/version/rotation | PASS: revoked updater cannot obtain a new signature; a previously signed update reverts at Paused; another reverts at VersionMismatch after resume. Rotation excludes old C, admits replacement with A, then restores A/B/C. Retargeted policy rejects old controller. Receipt reconciliation produces no duplicate broadcast/nonce increment. |
| O-06 pause/resume/recovery | PASS: pause blocks quotes/fills, emergency resume is denied, owner resume and a new update succeed. Owner pause/dock/recovery transfer succeeds. Both raw Aqua allocations are zero with docked marker 255; the active-only balance API correctly rejects docked liquidity. |
| O-07 / final F3 | PASS: clean live daily Graph pair -> actual restricted Privy update -> guarded canonical-token fill -> policy denial and unchanged state. Full permission/recovery matrix, unsafe rejection and fresh recovery all pass in the same F3 invocation. |


## Independent artifact audit

[Audit](final/audit.json) recomputes all six live pairs using Python Decimal at precision 90: raw daily USD decimals -> exact floored micro-USD -> hourly-equivalent turnover -> mapper output. All match. Each pair has two distinct pinned CIDs and an explicit 86,400-second window. Every named assertion passes; source hashes match Git content at the exact runtime revision.

For all accepted F2/F3 scenarios, independently checked maker/taker token deltas and at-target quote amounts against the $2,000/WETH fixture reference and effective spread. All failed scenarios have unchanged full protected state and reverted receipts. Actual Privy denial records have intended policy/authorization codes and HTTP correlation identity; remote-resource mutations and Sepolia batch probes leave their recorded state unchanged. Pending signed updates have retained Paused()/VersionMismatch() selectors linked to reverted receipts. Initial/final owner membership and signer enrollment match; a separate [live remote readback](final/remote-readback.json) verifies the actual restored 2-of-3 quorum and exact restricted policies.

The final validation manifest hashes retained files after scanning Graph/Privy secrets, encoded Basic authorization and all private P-256 keys. No raw signed transaction fields are retained. Sign-only requests use recovered wallet/request/hash records; HTTP cf-ray correlation is not mislabeled as a provider transaction ID.

## Limits and handoff

Positive token operations run on the accepted local canonical-token Ethereum fork (chain 31337), not mainnet. Actual Privy policies/signatures are live. Batch negatives use an empty Sepolia account, zero-value self-call, sponsor:false, and require policy denial plus unchanged balance/nonce; no public transaction succeeds. Snapshot branches are distinct scenarios, not one uninterrupted chain history. All development owner keys share one environment under user authorization. Hosted CI is configured but was not executed remotely.

Daily observations can still be absent or unavailable; that must fail live qualification and leave the existing runtime fallback behavior intact. This heuristic is not a current-hour volatility oracle or backtested profitability strategy. F4's unified scenario, broader failure orchestration and final independent handoff remain the next phase.

Historical hourly blockers and synthetic diagnostics remain in [checkpoint validation](checkpoint-validation.md) and checkpoint/. They are not the evidence used to pass this phase.
