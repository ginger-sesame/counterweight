# D12: toolchain, executable proof procedures, and handoff

Selected by root, 2026-09-06. **Phase 0–3 commands now exist; see [Phase 2 handoff and evidence](../phase2/README.md).** All commands labeled planned are interface/deliverable contracts for later agents; do not mark them run or gates passed until implemented and executed.

## Toolchain and file ownership

- Python 3.12.3 standard library for independent specification validation.
- Node 22.22.1 / npm 10.9.4; Node built-in test runner for future off-chain tests. TypeScript 5.9.3 is used to check provider request types. JavaScript ES modules are sufficient for the CLI; no UI framework required.
- Solidity 0.8.30; optimizer enabled, runs=700, viaIR=true, EVM target=cancun for the selected fork. Foundry 1.8.1 (forge/anvil/cast), build commit `982849d3140c01fd3b72905759581a132df7aa98`.
- Foundry Linux archive SHA256 `37b45855232e57624d90113b049ca54f0c92055bb5c1997fcbdc3076c7b89c10`; release https://github.com/foundry-rs/foundry/releases/tag/v1.8.1. Verify downloaded archive before extraction.
- Solidity dependencies pinned in INTEGRATIONS; prefer vendored/reviewable upstream source and exact package lock. Preserve upstream license/attribution. Do not chase main or introduce an unpinned SDK.
- Planning validation dependency lock: `scripts/planning/package-lock.json`, installed with `npm ci --prefix scripts/planning --ignore-scripts`. GraphQL 16.11.0, Privy Node 0.34.0, viem 2.56.3, TS 5.9.3. Phase 1 must separately lock application dependencies.

Planned ownership/layout:

| Path | Package / purpose |
| --- | --- |
| `contracts/CounterweightSwapVM.sol`, `contracts/libraries/` | P1/P2 quote, guard and dispatcher |
| `contracts/upstream/SwapVM.sol` and pinned dependency record | P2 minimally modified official base, explicit upstream diff |
| `contracts/EpochController.sol` | P2 immutable config, versioned tuning/pause; operations contract shared with P4 |
| `test/strategy/`, `test/integration/`, `test/invariant/` | S and V deterministic/fork suites |
| `src/data/`, `test/data/` | P3 schema, mapping, failure-state tests |
| `src/operations/`, `test/operations/` | P4 Privy request/policy handling and identity tests |
| `scripts/proofs/`, `artifacts/<run-id>/` | phase E2E runners, live evidence and manifests |

Agents agree controller ABI before parallel adapter work. Entry validation and post-settlement assertions are mandatory shared interfaces, not optional follow-up hardening.

## Existing Phase 0 commands

```sh
python3 scripts/planning/validate_phase0.py
npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund
node scripts/planning/validate_source_contracts.mjs
python3 scripts/planning/probe_rpc.py
```

The first checks fixed math/data/policy fixtures and package consistency offline. The source check requires public GitHub access, validates actual pinned schema fields plus modeled Graph Node query/filter API, registry versions/identities, SDK request types, and ABI roundtrip. It explicitly does not establish endpoint freshness or provider enforcement. RPC preflight is read-only against the fixed block and selected public provider and verifies token/funding-source prerequisites. Record outputs in `planning/phase0/evidence/`.

Isolated upstream experiment: clone SwapVM at its pin; `npm install --ignore-scripts --no-audit --no-fund` in that disposable checkout, verify the Aqua dependency resolves to the specified commit, then `forge test --match-path test/SwapVmAccounting.t.sol -vv`. Also run `forge test --match-path test/ControlsAqua.t.sol -vv` for shipping, settlement and rejection integration. The experiments use upstream code and mock-token tests, not a Counterweight F1. Preserve result summary and dependency identity. No need to rerun unaffected upstream tests on every Phase 0 edit.

## Environments, prerequisites and safety of proof setup

| Environment | Inputs | Acceptance use |
| --- | --- | --- |
| Offline | committed fixtures and lockfiles | P/S/G/O deterministic tests, no live claims |
| Local contract tests | deterministic actor accounts and mock tokens | component behavior, no F1 token provenance claim |
| Mainnet fork on local chain 31337 | archive RPC at block 25917718; original WETH/USDC bytecode; local Aqua/router/controller | F1 and integrated execution |
| Live Graph | GRAPH_API_KEY, both selected subgraphs, current Ethereum metadata | F2 |
| Live Privy signing + local broadcast | app credentials, owner quorum, actual organization wallet, updater/emergency signers and policies | F3/F4, same fork execution environment |

Credentials are not required to finish P0 planning, but are required to execute live F2/F3. Acquire GRAPH_API_KEY through Graph Studio and Privy app/owner setup through the account owner; inject via environment/secret store, never fixtures. Required names: `ETHEREUM_RPC_URL`, `GRAPH_API_KEY`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_ID`, `PRIVY_OWNER_QUORUM_ID`, `PRIVY_UPDATER_AUTHORIZATION_KEY`, `PRIVY_EMERGENCY_AUTHORIZATION_KEY`. Owner signing material is supplied through a separate quorum approval process, never a shared runtime env file. Record role IDs publicly only if appropriate, never keys or authorization headers.

Default read-only RPC candidate is `https://eth-mainnet.public.blastapi.io`, revalidated during clean-checkout reproduction. The initial `https://ethereum-rpc.publicnode.com` check passed earlier but subsequently returned HTTP 403 for historical token reads. Use ETHEREUM_RPC_URL to select a provisioned archive provider if the public default becomes unavailable. Fail preflight if returned chain/block/code differs. Anvil must bind 127.0.0.1; assert eth_chainId=31337 before any funding, impersonation, signing or broadcasting. Mainnet chain ID is deliberately not used for signed demo transactions.

Fork boot command (planned runner prerequisite):

```sh
anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --fork-url "$ETHEREUM_RPC_URL" --fork-block-number 25917718
```

A new run creates a fresh Anvil state and unique output directory; fixture cases use snapshots/reverts locally and new epochs as needed. Never share a mutable live fixture between agents. Advance the local clock to run UTC before opening epochs. Funding uses local Anvil ETH balance provisioning, canonical WETH.deposit(), and fork-only USDC pool impersonation. Bootstrap normal maker 10 WETH/20,000 USDC and taker 1 WETH/5,000 USDC. Upper-bound scenario instead starts maker 14 WETH/12,000 USDC. Record real ERC20 transfer receipts for setup separately from the required swap receipt.

## F1 procedure — Phase 2

Implemented and validated: `node scripts/proofs/f1.mjs --rpc http://127.0.0.1:8545 --out artifacts/<run-id>/f1`. The RPC must be a fresh pinned fork. Omitting `--rpc` boots and cleans up a fresh fork automatically. See Phase 2 evidence for completed F1.

1. Preflight chain ID, fork block/hash, token code/decimals, adequate funding source, and pinned dependency/build hashes. Reject mainnet RPC.
2. Encode the canonical epoch-salted order first and calculate its Aqua hash. Deploy pinned Aqua, controller/epoch with immutable maker/epochId/expected orderHash, and modified SwapVM pointing to that controller. Capture addresses, creation receipts, runtime code hashes, owner/maker/taker IDs, immutable safety digest, P and epoch times.
3. Fund actors. Maker approves Aqua for selected finite fixture budgets (not router or arbitrary spender). Ship exact ABI-encoded canonical order through Aqua; assert strategyHash equals SwapVM.hash(order), two token allocations, maker remains physical custodian. Verify constructor-bound canonical hash in controller; there is no routine registration setter. Activate only after all configuration checks pass.
4. Use upstream traits builders with the supported flags and 96-byte instruction args. Quote through static call as actual taker. Safe case: maker normal fixture, taker WETH input 0.1 WETH; expected 199400000 USDC at default tuning. Capture quote/state/version and minOutput.
5. Taker approves router for exact input. Broadcast `swap` with explicit gas limit; assert status=1, Swapped event, full input/output balance deltas, matching Aqua allocation deltas, exposure within bounds, zero unintended retained router/Aqua token balance. Repeat supported reverse direction on reset fixture.
6. Upper-bound fixture: maker 14 WETH/12,000 USDC; taker input 0.1 WETH. Normal quote rejects at guard. Construct structurally valid swap request directly to prove bypassing the quote API cannot bypass guard. Broadcast locally with explicit gas (avoid gas-estimation-only failure); require status=0, trace/call reproduces ExposureOutOfBounds, and unchanged token/allowance/controller/allocation state. Exclude sender gas spending from token accounting.
7. Run V-03–V-06 cases: changed inventory, sequential fills, obsolete versions/deadlines, empty/altered program, unexpected fee/hooks/callbacks, and settlement failure. For post-first-transfer failure, remove maker's output approval while retaining adequate balances and assert complete rollback; distinguish this transfer error from guard-specific failure.
8. Emit manifest/assertions; reset local snapshot or stop isolated Anvil. No external funds need cleanup. F1 PASS only with actual forked token settlement and failure evidence.

## F2 procedure — Phase 3

Implemented and validated 2026-09-08: [Phase 3 handoff and evidence](../phase3/README.md). Commands:

- `node scripts/proofs/graph-preflight.mjs --out artifacts/<run-id>/graph-preflight`
- `node scripts/proofs/f2.mjs --rpc http://127.0.0.1:8545 --out artifacts/<run-id>/f2`

1. Confirm key availability without printing it. Load registry, shared query, and completed-day variables using current UTC. Verify endpoint schema accepts query; fetch metadata and pin actual deployment CID/schema/methodology for each source. Query-ID and CID must not be conflated.
2. Run the exact same query text for both sources, changing only pool variable/endpoint. Retain sanitized responses, variables, query hash, fetch/source timestamps and source identity. Reject GraphQL errors, stale indexing, duplicate CID, mismatched token/pool/network/version, and missing completed-day snapshot. No keyless/static fallback qualifies.
3. Normalize as DATA specifies. Compute both turnovers and bounded mapping. For a valid pair, show the same consumer works across both sources; no source-specific mapping branches.
4. Record protected safety digest, perform authorized controller setTuning, then quote and perform a safe fill on F1 path. Compare with independently calculated old/new tuning outputs; if mapping is unchanged, assert the expected no-change and include separate deterministic fixture demonstrating sensitivity.
5. Attempt the unsafe upper-bound fill and verify guard rejection regardless of tuning. Compare protected safety digest before/after.
6. Inject stale/malformed observations into the runner's controlled test input; do not falsify the saved live responses. Stop fresh updates, advance local time beyond tuning TTL within epoch, demonstrate on-chain fallback and a safe/unsafe pair. Restore live valid observations and verify authorized recovery/version handling.
7. Save G-01–G-07 results. Live data outage/credential absence is BLOCKED; wrong responses/unsafe behavior is FAIL. Do not substitute another deployment without D07 revalidation.

## F3 procedure — Phase 4

Implemented commands (inject .env via Node or approved environment; see [Phase 4 handoff](../phase4/README.md)):

- `node scripts/proofs/privy-preflight.mjs --out artifacts/<run-id>/privy-preflight`
- `node scripts/proofs/f3.mjs --rpc http://127.0.0.1:8545 --out artifacts/<run-id>/f3`

1. With the account owner's authorization, create/read organization wallet and 2-of-3 owner quorum. Verify owner/member identities are distinct, policy ownership belongs to quorum, and updater/emergency entries have the intended self-contained override policies. Snapshot sanitized wallet/policy definitions and API/SDK versions.
2. Use that wallet as maker/controller authority on fresh fork fixtures. Materialize policy template with actual controller/quorum IDs; reject unresolved placeholders. Policy creation/update and commissioning require owner authorization, never updater keys.
3. Read nonce/version/epoch/time. Encode valid setTuning(900,28,version,now+300). Request Privy eth_signTransaction for chain 31337, native value zero, explicit to/data/gas/nonce/fees, signed by updater authorization key. Recover/inspect returned signed transaction: expected maker, chain, destination and calldata. Broadcast to local fork; assert successful receipt, version increment, correct tuning, unchanged safety digest.
4. Deploy a second controller for the same maker. Prove by local eth_call that identical setTuning would succeed there. Send a valid signing request with the same updater identity but second controller destination. Require policy-specific denial with request/operation ID and no signed bytes. Record unchanged state, no broadcast and no nonce consumption. Authentication error, timeout, or simulation failure does not pass O-03.
5. Execute remaining O-01–O-06 permission cases, including approval widening, code/epoch changes, wallet/policy edits, wrong chain/method, missing quorum signatures, pause/resume and revoked signer. Never run destructive negative cases on actual funded mainnet accounts.
6. Run live Graph -> real updater signature -> bounded tuning -> successful guarded fill, followed by unsafe rejection, using the same fork/maker/controller. Owner recovery tests check configuration and quorum rotation; do not export private keys.
7. Test pre-signed pending update during incident handling: pause, revoke, version invalidation, attempted broadcast, then approved resume. Record what chain nonce/version/expiry rejects; do not claim revocation alone invalidates signatures. Save O-07 and F3 artifacts.

## F4 integrated direction and regression commands

Planned `node scripts/proofs/mvp.mjs --rpc http://127.0.0.1:8545 --out artifacts/<run-id>/mvp` orchestrates the same F1/F2/F3 interfaces without resetting between primary integrated steps. Start upper-bound inventory 14 WETH/12,000 USDC, tune from live Graph, accept 200 USDC taker input (moves maker away from upper bound), then reject 0.5 WETH input that would breach the upper bound. Compare exact results against the independently defined math for effective tuning at execution.

It then covers stale-data recovery, inventory changes, failed settlement, pause/resume, revocation and restart reconciliation. Failure subcases can use explicit local snapshots; record branch IDs and never present mutually inconsistent snapshots as one uninterrupted chain history. Another agent reproduces the run from tracked files, approved credentials and documented prerequisites.

Implemented Phase 1 commands: `npm run test:strategy`, `npm run test:e2e`, and the simulated prototype runner below. Phase 2 integration/invariant and fork E2E commands are implemented in the root npm scripts; data commands are implemented; operations commands remain planned. Original command contracts: `forge test --match-path 'test/strategy/*.t.sol'`, `forge test --match-path 'test/integration/*.t.sol'`, `forge test --match-path 'test/invariant/*.t.sol'`, `node --test 'test/data/*.test.mjs'`, `node --test 'test/operations/*.test.mjs'`. Stage simulated E2E: `node scripts/proofs/prototype.mjs --fixtures planning/phase0/fixtures/accounting.json`.

CI (Phase 1 deliverable): pinned tool install, npm ci, offline specification check, deterministic S/G/O tests, and relevant local V integration. Property tests use seed 0xc0ffee and at least 1,000 generated examples per property; stateful invariant test has at least 128 sequences of depth 32, with failure seed/action sequence retained. Credentialed F2/F3 and archive fork jobs are explicit separate runs. Set unit job timeout 10 minutes, fork job 20 minutes, live proof job 30 minutes; individual network timeout/retry as DATA. A missing required job result cannot be counted as PASS.

## Evidence and result contract

Each run writes manifest.json, assertions.json, sanitized logs, setup identities/configuration, raw/normalized Graph evidence, policy snapshots, transaction/denial IDs, state before/after, and reproduction command. Manifest fields: runId, UTC time, Git revision, specification digest, dependency/tool versions, environment kind, chain/fork block/hash, contract/token addresses and code hashes, maker/taker/role identities, active order/epoch/tuning/policy versions, test IDs, result, evidence paths, limitations. Chain transaction hashes and Privy request IDs are different fields.

Result enum: NOT RUN, IN PROGRESS, BLOCKED, FAIL, PASS. Preserve failed evidence and distinguish negative-test PASS from failed execution. Redact authorization headers, app secrets, key-bearing URLs and signed raw transaction material that is still executable. Retain decoded transaction fields/hash and raw transaction hash instead. Check process exit statuses AND semantic assertions. Zero skipped required assertions.

Phase 4 credential implementation: app credentials and GRAPH_API_KEY are environment inputs; existing wallet/quorum/policy IDs are read from the owner-only resource journal, not duplicated across individual required environment variables. Key material is loaded from the separate owner-only development bundle under the explicit D09 custody amendment. F3 supports absolute PRIVY_KEYS_FILE and PRIVY_RESOURCES_FILE for clean reproduction; never copy credentials into artifacts. Batch-method negative proof additionally requires read access to Sepolia RPC and zero wallet balance on that testnet.
