Historical hourly query compatibility record. Current D08 v2 uses the same primary-key construction with day index and daily entity, as specified in [DAILY_REGIME.md](DAILY_REGIME.md).

# Live data compatibility revalidation — 2026-09-08

Same query IDs, deployment CIDs, pools, schema/methodology pins, freshness limits and USD mapping as Phase 3. No source replacement or safety change.

At Phase 4 execution time the selected Uniswap deployment timed out on the nested `inputTokens` relation, including direct pool requests with IDs only or `first:2`. Metadata, protocol metadata, hourly statistics, snapshot block and pool ID returned successfully. The initially suspected hour-filter bottleneck was not the complete diagnosis: the token relation was isolated as the failing field. Do not infer missing data is zero activity.

The live query now obtains a single completed-hour snapshot by primary key and its pool ID. Pinned Messari source [dexEventHandler.ts](https://github.com/messari/subgraphs/blob/2711ac91ef119f321f65b339e10a57f9aa74f9d8/subgraphs/uniswap-v3-forks/src/common/dexEventHandler.ts#L818) constructs that key from the pool address plus the hour encoded by `concatI32`. The implementation uses a four-byte little-endian signed integer suffix, confirmed against live IDs. `snapshotId` bounds hours to nonnegative i32 values. Snapshot ID, pool and hour must all match the requested completed hour. A null response fails; a primary key cannot represent duplicate entities. No broad or partial-hour query is substituted.

Token identity is now obtained from Ethereum RPC at the recorded head block: read `token0()` and `token1()` from each exact source pool, then `decimals()` from each returned token address. Require exactly canonical WETH/18 and USDC/6 regardless of order. Source block hash/time corroboration and token identity use the same recorded RPC chain/head context; tokenIdentityBlock must equal that head. Graph continues to supply USD statistics, not raw token amounts or strategy valuation. This removes a broken Graph relation while retaining explicit token/chain/decimal validation from the actual contracts.

The same Graph query and RPC consumer serve both sources. Evidence separates original Graph responses from RPC token provenance. The normalized `counterweight.regime.v1` output remains unchanged. The source-schema validator checks the singular ID variable and fields; synthetic fixtures record token metadata separately. Deterministic tests cover identities, token order/decimals, key/hour boundaries and RPC provenance. Both live sources must still qualify on every accepted update.

Reproduction: `node --env-file=.env scripts/proofs/graph-preflight.mjs --out <fresh-directory>`. F2/F3 regressions are required after this query change. Historical Phase 3 evidence describes the previous raw query and its then-successful token relation; it is not rewritten.
