# Phase 3: Graph normalization and guarded settlement

Status: PASS, completed 2026-09-08; [validation and evidence](evidence/validation.md). Owner: root; commits use ginger-sesame. F3/Privy and F4 remain NOT RUN.

## Interfaces and decisions

`src/data/normalize.mjs` consumes a raw query envelope plus trusted source registry and RPC context. It returns only the fields of `counterweight.regime.v1`, parses decimal USD using exact integer arithmetic, checks token identity rather than symbols/order, and corroborates metadata block hashes and timestamps against Ethereum. Missing Graph timestamps use the RPC block timestamp. Fetch age, indexing timestamp age and block lag are independent checks. Empty or duplicate hourly snapshots are rejected.

`src/data/regime.mjs` re-normalizes envelopes immediately before consumption. It requires two distinct source keys/query IDs/CIDs, checks completed-hour consistency and disagreement, and computes the bounded spread/intensity mapping. `updateArgs` accepts exactly the two tuning fields and builds the versioned controller arguments with a maximum 300-second validity. It never accepts a caller-supplied destination, price, safety limit or normalized observation. `effectiveState` reports startup, last-known-good and fallback; the controller independently enforces expiry at read/execution time. Validity and epoch-end equality follow the existing inclusive on-chain boundary; expiration occurs one second after the boundary.

`src/data/fetch.mjs` performs read-only requests with a 10-second request timeout, at most three attempts, 1/2-second retry delays, and a shared 35-second collection deadline. The two Graph requests run concurrently. RPC corroboration follows under the same deadline. Transport failures are sanitized; HTTP 429/5xx and transport timeouts retry, ordinary HTTP/JSON errors do not. One-source failure prevents a fresh update. No mutating transaction is retried. These are one-cycle CLIs, not a persistent service; a future scheduler can invoke the collector every 60 seconds, and must not extend tuning validity on failed fetches.

[Source revalidation](SOURCE_REVIEW.md) records the D07/D08 amendments. Both selected live schema versions are 4.0.0; historical registry versions remain distinct. The active Sushi pool uses the 3000 fee tier. Fixed CIDs and methodology versions in the registry reject deployment changes. Revalidation is required before changing those pins. Source availability is not guaranteed.

## Public commands

Install the pinned tools following [Phase 2](../phase2/README.md). Node 22.22.1, npm 10.9.4, Foundry 1.8.1 and existing lockfiles remain unchanged. Add `.tools/foundry` to PATH after installation.

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
npm test
npm run test:fork
node --env-file=.env scripts/proofs/graph-preflight.mjs --out artifacts/my-preflight
node --env-file=.env --test test/live/*.test.mjs
node --env-file=.env scripts/proofs/f2.mjs --out artifacts/my-f2
```

Use unique, nonexistent output directories. In CI or another clone, inject GRAPH_API_KEY directly and omit `--env-file`. The ignored local `.env` is not distributed. ETHEREUM_RPC_URL optionally selects an archive-capable Ethereum RPC; the documented public default is used otherwise. No raw key, key-bearing URL, or signed transaction is an evidence artifact.

`f2.mjs` automatically owns and stops a fresh loopback Anvil fork at the accepted block. Optional `--rpc http://127.0.0.1:<port>` requires a fresh caller-owned fork and leaves it running. Nonlocal RPCs are rejected before transaction creation. Canonical WETH/USDC funding, Aqua/SwapVM deployment, state snapshots, successful receipts, Swapped events, independent amount/accounting checks and guard-specific revert traces are shared with F1 in `scripts/proofs/settlement.mjs`.

The runner applies a live pair, fills safely, rejects independently copied stale/malformed inputs without updating, advances local time beyond TTL, fills under actual fallback, then fetches again and recovers on the same controller with a version increment. A separate explicitly reset upper-bound branch proves unsafe rejection under both live tuning and fallback. Advancing Anvil time is simulation: each update records wall-clock validation time and fork execution time separately. Live Graph freshness uses actual wall time; TTL behavior uses fork time. The initial safe fill is reset before fallback to preserve the independently calculated starting inventory. Branches are not presented as uninterrupted history.

Operations use the local maker account as a controlled substitute. This establishes on-chain update handling, not Privy policy enforcement. No production deployment, profitability or automated trading claim is made.

## Coverage and evidence contract

| Coverage | Executable evidence |
| --- | --- |
| G-01 | `test/data/normalize.test.mjs`, `pair.test.mjs`; both live normalized observations in preflight/F2 |
| G-02 | Numeric/type/token mutations, exact micro-dollar floors, forbidden update fields; actual update safety snapshots in F2 |
| G-03 | Exact age/lag thresholds, future and inconsistent blocks/times, RPC timestamp fallback; live RPC provenance |
| G-04 | `regime.test.mjs` timeout socket, retry counts/delays, 429/503, outage, startup/TTL/pause/recovery; F2 injected failures and on-chain expiry |
| G-05 | Exhaustive 10,001-input mapper domain, disagreement boundary, allowlist/version/TTL; actual controller config/digest and effective-tuning assertions |
| G-06 | `graph-preflight.mjs`: exact shared query, variables, original responses, fixed distinct identities, block/time provenance and normalized pair |
| G-07 | `test/live/f2.test.mjs` invokes public F2 CLI and checks artifacts/receipts/atomic failures; standalone proof retains evidence |
| S-07 / V regression | Existing deterministic suites and `test/fork/f1.test.mjs` rerun after shared harness extraction |

CI's deterministic job includes data tests in `npm test`. The existing fork job remains explicit. A separate `workflow_dispatch` input `run_graph` runs preflight, credentialed CLI E2E, and standalone F2 with retained artifacts. Missing credentials or exhausted transport retries produce BLOCKED evidence and nonzero exit, never skipped success. Invalid data/assertions produce FAIL. Hosted CI execution is separate from local clean reproduction.

Each F2 output includes manifest (revision, source/tool/dependency hashes, fork/token/controller identity), assertions, transactions, scenarios and `graph.json` (query, source registry, collection/provenance, normalized observations, source digest, unsigned update arguments, failure injection labels and wall/fork clocks). Every required assertion must pass; successful exit alone is insufficient.

## Completion checklist

- [x] Initial source revalidation and reviewed compatibility amendments. Completed: 2026-09-08; root; [evidence](SOURCE_REVIEW.md).
- [x] Normalizer, mapper, bounded transport and protected argument builder implemented with initial deterministic coverage. Completed: 2026-09-08; root; commits 53399e2, 116ecc7.
- [x] Shared settlement runner, live F2 and explicit CI/test entry points implemented. Completed: 2026-09-08; root; ce1f939, c53fcd9.
- [x] Final clean deterministic/F1/live regression and retained evidence audit. Completed: 2026-09-08; root; [validation](evidence/validation.md).
- [x] G-01–G-07 and F2 completion confirmed, shared/local checklists synchronized. Completed: 2026-09-08; root; [validation](evidence/validation.md).

Next after Phase 3 completion: Phase 4 actual Privy organization wallet and restricted signer policy proof. See OPERATIONS and PROOFS in Phase 0 for credential and owner-quorum prerequisites.

The source registry’s `liveVerified: false` is retained from the original planning snapshot; it is not used as a runtime gate or current status. The latest timestamped G-06/F2 artifacts above establish the live result; no static registry boolean can establish continuing freshness.
