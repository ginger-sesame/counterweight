# D08: normalized Graph contract — version 2

Decision: root agent, 2026-09-06. Consume the shared fields of Messari DEX-AMM Extended 4.0.x (Uniswap registry 4.0.0, Sushi registry 4.0.1) completed-day pool observations. One GraphQL operation is reused for both selected deployments. Never treat pool reserve ratios as the WETH reference price: concentrated-liquidity balances do not provide that price.

## Query and source identity

Use `fixtures/regime.graphql` and the source registry in `fixtures/sources.json`. Metadata + protocol + the daily snapshot are required; GraphQL errors, null required fields, indexing errors, mismatched network/schema/pool/tokens, or changed deployment CID reject the source. `_meta.block.timestamp` is preferred; if absent, resolve `_meta.block.number` to timestamp using Ethereum RPC and record this provenance. No substitution with HTTP retrieval time.

Let `windowEnd = floor(now/86400)*3600`, `windowStart=windowEnd-86400`. Fetch the last completed UTC day by its exact Messari primary key: selected pool address concatenated with the nonnegative day number encoded as little-endian i32. The shared query takes `$snapshot: ID!`; transport evidence also records pool/day variables. Require a non-null single snapshot whose ID, pool and day match. Null is missing data, never zero volume.

D08 amendment (2026-09-08): the live Uniswap `inputTokens` relation timed out. Read each pool's token0/token1 and their decimals through Ethereum RPC at the recorded head block; require canonical WETH/18 and USDC/6. Preserve source metadata and block corroboration separately. See [source investigation and compatibility contract](../phase4/DATA_COMPATIBILITY.md). Raw Graph and RPC token metadata remain distinct in evidence; the RPC identity handling is unchanged; the daily observation amendment below versions the normalized schema.

## Normalized output

Object `RegimeObservationV2` (additional fields forbidden):

| Field | Type / rule |
| --- | --- |
| schemaVersion | literal `counterweight.regime.v2` |
| sourceKey / subgraphId / deploymentCid | registry key, expected query ID, live `_meta.deployment` |
| sourceSchemaVersion / methodologyVersion | live-pinned `4.0.0` for both selected deployments / recorded nonempty version; methodology changes require revalidation |
| chainId / pool | 1 / registry pool address, lowercase canonical |
| weth / usdc | exact selected addresses and decimals 18/6; match IDs, never symbols |
| indexedBlock / indexedAt / fetchedAt | nonnegative integers, seconds for times |
| windowStart / windowEnd / observedAt | integer UTC seconds; snapshot ID and day match selected completed day; observation timestamp follows rules below |
| windowSeconds | literal 86400; the completed UTC day |
| volumeUsdMicro / tvlUsdMicro | decimal integer strings derived by flooring source decimal USD values *10^6 |
| turnoverBps | min(10,000, floor(10,000*volumeUsdMicro/(24*tvlUsdMicro))) |

Parse BigDecimal as decimal text without binary floats. Reject negative values, NaN/Infinity, scientific notation (not part of accepted wire format), >34 fractional digits or >64 total characters, >10^18 USD, TVL <1 USD, and missing/duplicate/wrong token IDs. Flooring USD stats at micro precision is acceptable for tuning only. Source responses remain distinct from normalized output and carry source metadata in evidence.

`fixtures/graph-responses.json` illustrates responses using both selected pools and reversed token order. It is synthetic, labeled as such, and not F2 evidence. Field shapes are checked against pinned schema source; Phase 3 must also validate the actual live endpoint schema and versions.

## Freshness and consistency

- Fetch every 60 seconds; per-request timeout 10 seconds; at most two retries after 1 and 2 seconds (total cycle budget 35 seconds). Never retry mutating transactions through this path.
- Indexed source timestamp age <=300 seconds; source block lag <=25 relative to current Ethereum RPC head. Metadata more than 30 seconds in the future is invalid.
- Fetched response age <=120 seconds before mapping. Require both observations describe the same windowStart/windowEnd and use the expected pool.
- Observed timestamp must be >= windowStart, <= indexedAt+30, <= now+30, and no more than 172,800 seconds old. The standardized snapshot timestamp may be updated after its day ends, so filter by the explicit `day` field, not timestamp range. An inactive pool with no daily snapshot is unavailable.
- Require both valid sources for fresh tuning. No one-source mode in MVP. Compute `r=max(turnoverBps_A, turnoverBps_B)` as the conservative activity signal. If the two turnover values differ by more than 5,000 bps, enter fallback rather than averaging away the discrepancy. Equality at thresholds is accepted.
- These are regime observations, not authenticated price-oracle claims. All derived outputs remain within the immutable tuning envelope even under malicious but schema-valid data.

## Mapping and fallback

For a valid consistent pair:

`spreadBps = 10 + floor(90*r/10_000)` (10..100)

`intensityBps = 1_000 - floor(500*r/10_000)` (500..1,000).

Higher volume/TVL activity widens spread and reduces the inventory incentive. This is a deterministic MVP heuristic, not a backtested profitability claim. `sourceDigest` is a hash of normalized observations included in evidence/events, never a safety input.

Fallback values: spread=100, intensity=0. Startup has no valid live state and uses these values. A last-known-good tuning update lasts at most 300 seconds from update acceptance; failed fetches do not extend it. When it expires the contract computes fallback at read/execution time, even if the off-chain process has stopped. Future/invalid update validity is rejected; no setting a far-future expiry. Returning to fresh requires a new valid pair and authorized versioned update.

Pause and epoch expiry override both fresh and fallback: no quoting/execution. A new tuning update invalidates old quote versions. Transition to time-expired fallback does not need a transaction; quote minOutput plus execution-time recomputation handles price changes within a version. The runner reports effective tuning state and validUntil, not just the last stored values.

## Integration boundaries

Off-chain normalizer -> pure mapper -> `setTuning(uint256 intensityBps,uint256 spreadBps,uint64 expectedVersion,uint40 validUntil)` on the epoch/controller. Contract accepts only the authorized maker wallet, valid ranges, expected current version, and validity in `(now,now+300]`. It increments tuningVersion. No price, limits, custody, or executable target in this ABI.

The Graph worker constructs data and unsigned requests; the restricted Privy updater authorizes them. The same transaction uses both values atomically. Safety configuration is immutable per epoch and its digest must match before/after each update. On-chain range checks are independent of the off-chain mapper and policy. EpochId/orderHash are fixed by destination/controller identity.

## Tabletop examples

- r=0 -> spread=10, intensity=1,000.
- Source turnovers 1,000 and 2,000 -> r=2,000 -> spread=28, intensity=900.
- r=10,000 -> spread=100, intensity=500.
- Missing second source -> no fresh update; retain prior unexpired values only; after expiry -> spread=100/intensity=0.
- Bad token order with correct IDs -> reorder by ID and accept; duplicate or wrong token -> reject.
- Valid source proposing `maxWethBps` -> schema/ABI rejection; protected configuration unchanged.

G-01–G-07 implement these as application tests in Phase 3; P0 only validates fixture arithmetic, common source fields, and procedure completeness.

2026-09-08 D08 amendment: accept up to 34 fractional digits in bounded decimal text, then floor exactly to micro-USD. Actual Graph decimal128 responses exceed the initial 18-place assumption. See [Phase 3 source review](../phase3/SOURCE_REVIEW.md). USD magnitude, minimum TVL, freshness, mapping and all safety limits are unchanged. RPC corroborates the indexed block hash and timestamp, including the timestamp-absent fallback.

2026-09-09 D08 v2 amendment: user authorized a slightly different demo that preserves the main goals. Both original standardized deployments remain live inputs; use explicit completed-day observations and average hourly turnover = daily volume / (24 * snapshot TVL). This is a slower activity signal, not current-hour volatility. Exact source period and a 172,800-second maximum observation age replace hourly selection/7,200 seconds; indexing freshness, fetch age, both-source requirement, mapper caps, 300-second on-chain expiry, permissions and inventory safety are unchanged. Missing daily records still reject. See [daily-regime decision and tests](../phase4/DAILY_REGIME.md). Prior hourly evidence remains historical.
