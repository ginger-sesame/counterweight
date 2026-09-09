# The Graph proof bundle

Two distinct pinned standardized Ethereum deployments remain selected: Uniswap V3 and SushiSwap V3. [Source identities](../../phase0/fixtures/sources.json), [current daily query](../../phase0/fixtures/regime.graphql), and [completed-day decision](../../phase4/DAILY_REGIME.md) define the exact contract. Daily volume / 24 relative to recorded TVL is a slower activity signal, not an execution-price oracle.

- [F2 manifest](../evidence/primary-clean/f2/manifest.json) and [Graph evidence](../evidence/primary-clean/f2/graph.json): live collection, two-source validation, bounded tuning, fallback and recovery.
- [F4 Graph evidence](../evidence/primary-clean/f4/graph.json): three actual live pairs, raw responses, RPC identity/block corroboration, normalized windows, mapping values, source digest and restricted update transaction hash. The separate stale injection is explicitly labeled.
- [F4 configuration](../evidence/primary-clean/f4/configuration.json) and [assertions](../evidence/primary-clean/f4/assertions.json): immutable safety configuration before/after permitted tuning and actual effective on-chain values.
- [Independent audit](../evidence/primary-clean/f4-audit.json): Python Decimal recomputation of micro-USD, hourly-equivalent turnover and mapped parameters.
- [Source contract validation](../evidence/primary-clean/source-contracts.log): pinned SDL query compatibility and deployment registry identities.

Reproduce with the documented credentialed `test/live` CLI and `scripts/proofs/f2.mjs`, then the integrated MVP. Both sources must qualify at runtime. Absent daily entities, stale indexing, mismatched identities and missing observations cannot be replaced by fabricated zero activity or old-period data. Source qualification limitations remain those in the tracked integration review.
