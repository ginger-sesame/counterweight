# D08 v2: completed-day activity signal

Decision 2026-09-09, root, under the user's explicit authorization to adapt the demo while preserving its main goals. Status: PASS. Implemented at 49cd68b; clean F2/F3 and independent audit recorded in [final validation](evidence/validation.md).

The hourly blocker is genuine inactivity in the selected Sushi pool: Ethereum blocks 25936986–25937283 cover 2026-09-09 03:00–04:00 UTC and contain zero Swap events. The indexed head is current, but event-driven hourly entities need not exist. Missing records are not evidence of a broken indexer. We will not fabricate hourly zeros or silently pick older hours.

Select the last completed UTC day for both original standardized Graph deployments/pools. Initial read-only probes returned non-null daily entities for both. This is a deliberate change to a slower activity signal, not a claim that old hourly observations are fresh. Keep current indexing/RPC head limits, exact CIDs, canonical token identity, fetch age, both-source requirement, disagreement rule, short on-chain validity and all immutable safety/Privy restrictions.

Deliverables and acceptance:

- [x] Shared daily primary-key query: pool + little-endian i32 day index, using liquidityPoolDailySnapshot and dailyVolumeUSD. Null still rejects; no hour/day automatic fallback.
- [x] Versioned normalized output counterweight.regime.v2 with windowStart/windowEnd and windowSeconds=86400. Exact previous UTC day; observedAt >= windowStart, age <=172800 seconds, no future/indexed-block contradictions. Indexed head <=300 seconds/25 blocks and fetch age <=120 seconds remain unchanged.
- [x] Average hourly turnover: min(10000, floor(dailyVolumeUsdMicro*10000/(24*tvlUsdMicro))). Preserve exact micro-USD arithmetic and the existing bounded mapper. Explicitly distinguish daily source volume from hourly-equivalent activity.
- [x] Unit/component tests: v2 shape, reject hourly payloads, missing/current/older day, UTC midnight transitions, observed-time boundary, source mismatch, decimal extremes, saturation and independent 24-hour scaling examples. Preserve outage, source identity, RPC corroboration and fallback tests.
- [x] Pinned source/GraphQL compatibility and planning fixture checks pass. Regress actual F2 safe/unsafe/fallback/recovery and F3 live full permission matrix; verify immutable config and actual token effects.
- [x] Clean checkout live CLI and retained F3 proof, independent Decimal audit, source/artifact hashes and secret scan. Update Phase 4 checklists and handoff only after final acceptance.

This signal reflects previous-day activity relative to recorded liquidity; it is not current-hour volatility, a price oracle or a profitability claim. Daily observations update less frequently while authorized tuning still expires within 300 seconds without renewal. An entirely inactive day or source outage still fails qualification and uses the existing bounded runtime fallback. No successful public-network operation is introduced.
