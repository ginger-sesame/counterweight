# Counterweight

Inventory-seeking, self-custodial WETH/USDC liquidity strategy for Aqua/SwapVM.

Phase 0 specifies the MVP. Phase 1 implements and tests the deterministic quote and hard inventory guard through a simulated EVM pipeline. SwapVM settlement, Graph ingestion, and Privy enforcement remain subsequent phases; no live feasibility gate has passed.

Start with the [implementation contract](planning/phase0/README.md), [Phase 1 handoff and test checklist](planning/phase1/README.md), and [validation evidence](planning/phase1/evidence/validation.md).

Use Node **22.22.1**, npm **10.9.4**, Python **3.12.3**, and Linux x86_64 for the verified setup:

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
python3 scripts/planning/validate_phase0.py
forge fmt --check
npm test
mkdir -p artifacts/local
node scripts/proofs/prototype.mjs --fixtures planning/phase0/fixtures/accounting.json --out artifacts/local/prototype.json
```

The installer verifies the pinned Foundry 1.8.1 archive checksum before extraction. Forge downloads Solidity 0.8.30 on first compilation. Setup needs public npm/GitHub/compiler-download access; tests then use local fixtures and an isolated Anvil instance. No credentials or external RPC are needed. `.env.example` documents optional binary overrides for the CLI; npm's Solidity command expects `forge` on `PATH`. `.env` is not loaded automatically.

The CLI emits JSON and exits nonzero on any failed assertion. It deploys the prototype on a fresh loopback-only local EVM, executes the compiled contract, and shuts down its node. WETH/USDC addresses identify units in this simulation; no token contracts or token transfers are involved. Output is projected inventory, not settlement evidence. Each run starts fresh.

For the existing read-only provider compatibility checks:

```sh
npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund
node scripts/planning/validate_source_contracts.mjs
python3 scripts/planning/probe_rpc.py
```

These checks require public network access. See [future proof procedures](planning/phase0/PROOFS.md) for F1–F4 environments, commands, and account prerequisites.
