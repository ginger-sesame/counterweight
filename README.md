# Counterweight

Inventory-seeking, self-custodial WETH/USDC liquidity strategy for Aqua/SwapVM.

Phase 0 specifies the MVP. Phases 1 and 2 implement the deterministic quote/guard core and actual guarded Aqua/SwapVM settlement. The F1 proof uses canonical WETH/USDC on the accepted local mainnet fork. Phase 3 implements live Graph ingestion. Phase 4 adds actual restricted Privy operations, recovery and clean live proof; F1–F3 pass. Phase 5 adds the continuous integrated CLI and read-only process restart reconciliation. Its clean F4 run passes 97 assertions, with all earlier regression gates passing at the integrated runtime revision. Independent-agent reproduction remains pending; Phase 5 is not yet complete.

See the [Phase 4 handoff](planning/phase4/README.md) and [final validation](planning/phase4/evidence/validation.md). The current regime signal uses two live standardized daily observations, converted to average hourly activity; hard inventory limits remain independent.

Start with the [implementation contract](planning/phase0/README.md), [Phase 2 handoff and test checklist](planning/phase2/README.md), and [settlement validation evidence](planning/phase2/evidence/validation.md).

Use Node **22.22.1**, npm **10.9.4**, Python **3.12.3**, and Linux x86_64 for the verified setup:

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
python3 scripts/planning/validate_phase0.py
python3 scripts/planning/validate_upstream.py
forge fmt --check
npm test
mkdir -p artifacts/local
node scripts/proofs/prototype.mjs --fixtures planning/phase0/fixtures/accounting.json --out artifacts/local/prototype.json
```

The installer verifies the pinned Foundry 1.8.1 archive checksum before extraction. Forge downloads Solidity 0.8.30 on first compilation. Setup needs public npm/GitHub/compiler-download access; tests then use local fixtures and an isolated Anvil instance. No credentials or external RPC are needed. `.env.example` documents optional binary overrides for the CLI; npm's Solidity command expects `forge` on `PATH`. `.env` is not loaded automatically.

The CLI emits JSON and exits nonzero on any failed assertion. It deploys the prototype on a fresh loopback-only local EVM, executes the compiled contract, and shuts down its node. WETH/USDC addresses identify units in this simulation; no token contracts or token transfers are involved. Output is projected inventory, not settlement evidence. Each run starts fresh.

Run the canonical-token settlement proof separately (archive RPC access required):

```sh
npm run test:fork
node scripts/proofs/f1.mjs --out artifacts/my-f1-run
```

The F1 runner boots and cleans up a fresh local fork, broadcasts successful and rejected swap transactions, and retains receipts, state assertions and traces. `ETHEREUM_RPC_URL` optionally overrides the public archive endpoint. Use a new output directory for every run. See the Phase 2 handoff for external-node usage, exact coverage and evidence interpretation.

For the existing read-only provider compatibility checks:

```sh
npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund
node scripts/planning/validate_source_contracts.mjs
python3 scripts/planning/probe_rpc.py
```

These checks require public network access. See [proof procedures](planning/phase0/PROOFS.md) for F1–F4 environments, commands, and account prerequisites.

For live Graph/Privy E2E commands, approved credential/journal setup, and serialized wallet access, follow the [Phase 4 reproduction instructions](planning/phase4/README.md#credentials-and-repeatable-commands). Daily-source availability and exact policy enforcement are required; mocked diagnostics cannot pass F3.

For Phase 5 setup, complete gate reproduction, failure recovery and artifact interpretation, follow the [integrated MVP handoff](planning/phase5/README.md). The public entry point is:

```sh
node --env-file=/absolute/path/to/approved.env scripts/proofs/mvp.mjs --out artifacts/my-f4-run
```

It uses one epoch throughout live tuning, real fills, guard and settlement failures, pause/resume, revocation and recovery. A separate credential-free process verifies the persisted transaction checkpoint without repeating an operation. F4 does not establish production readiness.
