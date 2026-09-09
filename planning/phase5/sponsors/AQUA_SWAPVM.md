# Aqua/SwapVM proof bundle

Runtime `57e6e67`; accepted environment: canonical WETH/USDC contracts on a pinned local Ethereum fork, chain 31337. Only the funding pool is impersonated; the maker in F4 signs through actual Privy. No public deployment is claimed.

- [F1 manifest](../evidence/primary-clean/f1/manifest.json): pinned dependencies, fork block/hash, contract/token code hashes and 80 assertions across five scenarios.
- [F1 scenarios](../evidence/primary-clean/f1/scenarios.json): real maker/taker/Aqua allocations and physical token deltas in both directions, exposure guard failures and atomic output-transfer failure.
- [F4 scenarios](../evidence/primary-clean/f4/scenarios.json): one epoch, 200 USDC safe input, 0.5 WETH rejected input, concurrent-inventory rejection, settlement rollback and successful post-recovery fill.
- [F4 receipts](../evidence/primary-clean/f4/transactions.json): actual SwapVM settlement events and reverted receipts.
- [Independent audit](../evidence/primary-clean/f4-audit.json): quote-floor intervals, projected rejected exposures, conservation and continuous history.
- [Deterministic suites](../evidence/primary-clean/deterministic.log): canonical-entry validation, physical backing, rollback, replay/concurrent inventory, reentry and stateful guard invariants.

Reproduce with `npm run test:fork`, `node scripts/proofs/f1.mjs --out artifacts/f1`, and credentialed `node scripts/proofs/mvp.mjs --out artifacts/f4` using the complete setup instructions. Static $2,000/WETH epoch valuation and dedicated strategy allocation are explicit MVP limits; no returns or guaranteed rebalancing are claimed.
