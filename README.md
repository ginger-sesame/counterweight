# Counterweight

Inventory-seeking, self-custodial WETH/USDC liquidity strategy for Aqua/SwapVM.

Start with the [Phase 0 implementation contract](planning/phase0/README.md), [readiness audit](planning/phase0/evidence/readiness.md), and [test/decision ledger](planning/phase0/TRACEABILITY.md). Application implementation has not started; live feasibility gates are not yet passed.

Run the offline specification checks:

```sh
python3 scripts/planning/validate_phase0.py
```

For source compatibility checks (public network access required):

```sh
npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund
node scripts/planning/validate_source_contracts.mjs
```

Read-only fork prerequisites: `python3 scripts/planning/probe_rpc.py`. See [proof procedures](planning/phase0/PROOFS.md) for pinned tools, exact environments, planned implementation commands, and credential requirements. Do not confuse these planning checks with real strategy execution or provider-policy proof.
