# Phase 5 integration handoff

Status: IN PROGRESS. Phase 4 evidence remains historical; integrated-revision regressions and F4 have not yet run.

## Deliverables and acceptance

- [ ] E-01: `scripts/proofs/mvp.mjs` runs one continuous local fork history with actual Privy owner setup, 14 WETH/12,000 USDC allocation, two live completed-day Graph sources, restricted tuning, a 200 USDC fill, a 0.5 WETH guard rejection, and a valid forbidden Privy request. Retain exact state deltas, source/configuration/policy identities and receipts.
- [ ] E-02: Inject stale data, recover from fresh observations, change inventory between quote and execution, force settlement rollback, pause/resume and revoke/re-enroll the updater. Record each expected failure and unchanged protected state. No implicit snapshot reset.
- [ ] E-03: Persist a public transaction checkpoint before broadcast. A new process reconciles its receipt against chain/fork, contract code and immutable configuration identity without signing or broadcasting. Missing or uncertain transactions require reconciliation; no automatic replacement. Reject configuration drift, and report expired observation freshness separately from transaction completion.
- [ ] Unit/component checkpoint tests: mined, pending, absent, transport failure, wrong chain, wrong fork, changed code/configuration, failed receipt and freshness expiry. Then exercise the actual subprocess against the live local fork.
- [ ] E-04: Independent agent clean reproduction using only tracked setup instructions and explicitly supplied external credentials/resource files. Compare semantic assertions; do not require identical live values or hashes.
- [ ] E-05: Audit all artifacts for exact source/specification hashes, commands, role and transaction identities, complete test mapping and secrets. Produce sponsor-specific indexes and a clean reproduction report.
- [ ] Run deterministic suites, planning/source validation, F1/F2/F3 public CLI regression and F4 at the integrated runtime revision. Preserve failures; publish PASS only for completed assertions.

## Recovery contract

The MVP is a bounded CLI proof, not a persistent production service. Restart reconciliation never needs private keys. Its checkpoint contains only public identities and a transaction hash; raw signed transactions are not persisted. A mined receipt establishes transaction completion even when its market observation has subsequently expired. `fetchAgeAcceptable` reports only the checkpoint fetch-age check; every new update still requires collecting and validating a new two-source pair, including its observation window and indexed/RPC identity. Expired observations must never authorize a new update. An absent hash or unavailable RPC is not permission to repeat an operation. Resume requires the original live local fork; a fresh fork with reused contract addresses is rejected through deployment/configuration provenance.

The shared technical contracts remain under tracked `planning/`. Local `docs/` and credentials remain unpublished under D14. Final commands, evidence links, architecture and sponsor indexes will be added as their implementations are validated.

## Setup and complete reproduction

Use Linux x86_64, Node 22.22.1, npm 10.9.4 and Python 3.12.3. Start from a clean checkout of the recorded runtime revision. All non-secret prerequisites are tracked. Supply an approved environment file containing GRAPH_API_KEY, PRIVY_APP_ID and PRIVY_APP_SECRET, plus absolute paths to the existing mode-0600 Privy key bundle and mutable resource journal described in [Phase 4](../phase4/README.md#credentials-and-repeatable-commands). Do not copy these into the checkout or artifacts. Optional ETHEREUM_RPC_URL must support the pinned archive block. Public source checks also need GitHub access. No public token funding is required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
export PRIVY_KEYS_FILE=/absolute/path/to/privy-development.json
export PRIVY_RESOURCES_FILE=/absolute/path/to/privy-resources.json
mkdir -p artifacts/reproduction
python3 scripts/planning/validate_phase0.py
python3 scripts/planning/validate_upstream.py
node scripts/planning/validate_source_contracts.mjs
forge fmt --check
npm test
npm run test:fork
node --env-file=/absolute/path/to/approved.env --test test/live/*.test.mjs
node --env-file=/absolute/path/to/approved.env --test test/privy/*.test.mjs
node --env-file=/absolute/path/to/approved.env --test test/mvp/*.test.mjs
node scripts/proofs/f1.mjs --out artifacts/reproduction/f1
node --env-file=/absolute/path/to/approved.env scripts/proofs/f2.mjs --out artifacts/reproduction/f2
node --env-file=/absolute/path/to/approved.env scripts/proofs/f3.mjs --out artifacts/reproduction/f3
node --env-file=/absolute/path/to/approved.env scripts/proofs/mvp.mjs --out artifacts/reproduction/f4
```

Serialize **all** F3/F4 commands and any other operation on this development Privy wallet. These runs retarget its restricted policies to fresh local controller deployments. They retain the same owner quorum and restore the updater after revocation testing. An interrupted run may leave the updater revoked; inspect the remote wallet and rerun documented `configureSigners` setup through the next proof before attempting updates. Never infer completion from a local journal alone. Provider provisioning uncertainty requires remote reconciliation, as described in Phase 4.

Each output directory must be new. CLI errors exit nonzero; missing live data is not a pass. Keep stdout/stderr alongside retained artifacts. The managed fork terminates at run completion. For manual restart investigation, start a fresh Anvil at the pinned block per [Phase 2](../phase2/README.md), pass `--rpc http://127.0.0.1:8545` to the MVP runner, and retain that process. Then `node scripts/proofs/reconcile.mjs http://127.0.0.1:8545 artifacts/reproduction/f4/checkpoint.json` reads its status without signing or broadcasting. A completed managed-fork run cannot be resumed against a newly created fork.

## Architecture and observable recovery

`mvp.mjs` joins the existing settlement harness, Graph collection/normalization/mapper and Privy provisioning/signing modules. The harness deploys one immutable epoch and canonical SwapVM order. Actual restricted signatures are decoded and checked before broadcasting only to chain 31337. The independent quote calculation consumes current Aqua allocations. All seven settlement attempts share epoch 30 and strictly increasing block numbers; there are no scenario reverts.

| Step | Expected observable result | Evidence |
| --- | --- | --- |
| Live update | Two distinct pinned CIDs, bounded effective tuning, unchanged configuration, incremented version | graph.json, transactions.json, configuration.json |
| Safe/unsafe fills | Actual token/accounting deltas for 200 USDC; guard-specific atomic rejection for 0.5 WETH | scenarios.json, assertions.json |
| Concurrent inventory | Old quote initially succeeds; intervening fill changes allocations; execution of old request fails guard | scenarios.json, assertions.json |
| Settlement failure | Input transfers execute before failed output transfer; entire transaction rolls back | scenarios.json nested call trace |
| Stale/recovery | Injected stale fetch rejected; expired tuning falls back; fresh actual observations restore bounded tuning | graph.json, scenarios.json, events.json |
| Pause/revocation | Emergency pause blocks execution; owner resumes; revoked updater gets actual authorization denial; owner re-enrolls and updater succeeds | operations.json, transactions.json, final-state.json |
| Restart | Public checkpoint precedes broadcast; new credential-free process finds receipt without repeating nonce or signature | checkpoint.json, restart.json |

The CLI is the MVP interface. There is no scheduler, UI or unattended production daemon. Read-only restart handles uncertainty without inventing transaction intent or resubmitting it. The original public checkpoint is retained to reproduce the crash-after-broadcast/before-receipt-recording case.

## Evidence and sponsor indexes

- Aqua/SwapVM: F1 retained proof plus F4 scenarios, immutable epoch/code hashes and token deltas. Deterministic integration/invariant suites cover additional entry-point and stateful safety cases.
- The Graph: F2 retained proof plus F4 graph.json, pinned queries/sources, source digests, normalized daily windows and actual restricted update receipts. Missing source records never become inferred zeros.
- Privy: F3 complete permission matrix plus F4 configuration, decoded signature identities, real denials and restored wallet state. Single-environment development custody is explicit.
- Integration: F4 manifest, assertions, continuous transactions, events, seven scenarios and restart checkpoint/result.

These indexes identify intended deliverables, not completed sponsor submissions. Final validation must link concrete artifacts and audit results at the recorded runtime revision. E-04 remains pending until an authorized independent agent reproduces the instructions above.

Audit a retained F4 run at its committed runtime revision:

```sh
python3 scripts/proofs/audit-mvp.py artifacts/reproduction/f4 --out artifacts/reproduction/f4-audit.json
node --env-file=/absolute/path/to/approved.env scripts/proofs/audit-secrets.mjs artifacts/reproduction artifacts/reproduction/secret-audit.json
```

The independent arithmetic audit requires the recorded revision in the local Git object database. It rejects modified runtime sources whose hashes differ from that revision. The secret audit requires the approved key bundle and environment so it can scan for actual credential values without printing them. Run it after collecting all evidence. Hosted CI offers an explicit `run_mvp` option in the same wallet-serialized job as `run_privy`; a configured job is not evidence that hosted CI has run.
