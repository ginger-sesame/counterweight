# Phase 0 readiness audit

**Status: PASS — planning readiness only.** Reviewer: root agent. Date: 2026-09-06. F1, F2, F3 and F4 remain **NOT RUN**. No Counterweight application or contracts have been implemented, deployed, or operated.

## Requirement-by-requirement audit

| Work package | Required output | Evidence inspected | Result |
| --- | --- | --- | --- |
| P0-A | D01–D04/D11, units/equations, bounds, recovery, quote lifecycle, independent examples | ACCOUNTING.md; 16 fixed quotes and 9 exact guard boundary fixtures; accounting-review.md; offline-validation.txt | PASS |
| P0-B | Actual extension/settlement mechanism, pins, accepted transfer environment, two source identities, sponsor criteria, prerequisites | INTEGRATIONS.md; source-validation.json; rpc-preflight.json; upstream-review.md; pinned SDK declarations | PASS for planning/source compatibility, not live acceptance |
| P0-C | Data schema/freshness/fallback; separate tuning/safety; complete authority matrix; pause/governance/recovery; component flow/threat mapping | DATA.md; OPERATIONS.md; policy/wallet/quorum templates; 17 updater rule scenarios; exhaustive finite activity mapping; role/threat tabletop | PASS |
| P0-D | Toolchain/layout/commands, concrete F1–F3 setup/action/assertion/cleanup, CI split, traceability and handoff | PROOFS.md; TRACEABILITY.md; package lock; README; checks on all 14 decision and 38 test mappings | PASS |
| P-01 | Decisions resolved and proof procedures usable by implementation agents | D01–D14 ledger plus artifacts above; no unresolved technical interface placeholder beyond generated run/account identities | PASS |
| P-02 | Independently reviewed dimensional/numeric examples | exact rational/integer floor-interval checks and manual anchors | PASS |
| P-03 | Primary-source integration/qualification verification and explicit uncertainty handling | pinned source fields, registry schemas/IDs, Graph Node relationship-filter rule, SDK request types, real read-only RPC; upstream execution experiments | PASS |
| P-04 | Permission/threat mapping and table-top failure outcomes | OPERATIONS threat rows; decoded policy-case model; emergency and owner restrictions; data fallback design | PASS |

## Validation performed and its limits

- Offline validator: 16 quote fixtures, 9 boundary fixtures, 2 synthetic Graph response fixtures, 10,001 activity inputs, 17 updater policy cases, a removed-destination mutation, owner/emergency/ownership shape checks, 14 decisions, and 38 test mappings.
- Source validator: two published registry identities and schema versions; shared query against pinned source entity SDL and the modeled Graph Node-generated API; wrong variable-type and unknown-field negative mutations; three policy plus wallet/quorum request types against Privy SDK; calldata encode/decode.
- RPC: fixed block/hash/chain, actual token code/decimals, actual factory-derived WETH/USDC pools, and fork funding-source balance. Read-only; no token transfers performed in P0.
- Upstream experiment: official SwapVM accounting tests compiled and passed; see upstream-review for precise suites and results. This is an integration/toolchain investigation, not Counterweight E2E proof.
- Clean-checkout offline checks and npm-ci source/SDK validation passed without ignored docs or preinstalled node_modules. The original public RPC returned HTTP 403 on historical reads during reproduction; the alternate configured endpoint reproduced all fixed-block assertions successfully. See clean-reproduction.md.
- Document/link/test-ID consistency and Git whitespace checks. No application unit/E2E tests exist yet; their required commands and assertions are specified phase by phase.

During review, corrected three material assumptions: concrete AquaSwapVMRouter dispatch is not directly overridable; Graph Node's relationship filter is String despite Bytes IDs; selected Uniswap and Sushi schema patch versions differ (4.0.0 versus 4.0.1). Also switched completed-hour selection to the explicit snapshot hour because snapshot timestamps may be updated after the interval. Epoch bytes now include epochId so rollover changes the order hash.

## External prerequisites and scope boundaries

- ETHOnline 2026 is the inferred working sponsor baseline matching the brief; another selected event requires qualification revalidation. Submission/registration/publication is not performed.
- Graph API key and Privy app credentials are absent. Their acquisition/setup steps are explicit in PROOFS. Credential absence is permitted at P0; actual F2/F3 remain NOT RUN and cannot pass without live results.
- Source registry is evidence of schema/provenance, not current indexing health. Sushi v3 Ethereum is labeled dev. F2 must verify freshness, actual deployment CIDs and metadata at runtime; it must block/fail rather than silently substitute static data or an unreviewed source.
- Public archive RPC may become unavailable. A provisioned archive RPC must reproduce the pinned block/hash; changing fork block requires recording new provenance/funding checks.
- Controlled immutable valuation epoch, dedicated strategy allocation, constrained exact-input mode, and local chain 31337 are intentional MVP decisions. They do not imply production readiness or treasury-wide price risk protection.
- Owner quorum has broad commissioning authority on the local fork. Runtime/updater restrictions do not make the owner unable to deliberately change wallet policy; immutable active-epoch safety remains enforced by contract design.

## Handoff

Proceed to Phase 1's complete quote/guard prototype and simulated E2E package. Consume the fixed accounting fixtures, API contracts, and dependency pins. Implement S-01–S-08 and capture evidence before declaring Phase 1 complete. Keep F1–F4 and all application test IDs unchecked until those actual tests run.

Shared artifacts live in tracked planning/. Ignored docs/ remains a synchronized local orchestration checklist. Logical commits record accounting first, integration contracts second, and final validation/handoff third. Artifact digests in validation-manifest.json identify the reviewed state independently of the local-doc Git policy.
