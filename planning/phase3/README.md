# Phase 3 agent handoff

Status: IN PROGRESS (2026-09-08, root). F2 has not passed.

Completed initial work:

- Read all local product, architecture, bounty, implementation, testing, and decision contracts.
- Executed the exact live query against both original sources; retained sanitized results.
- Recorded D07/D08 corrections in [SOURCE_REVIEW](SOURCE_REVIEW.md): active Sushi pool, deployed schema versus registry version, decimal precision, fixed deployment/methodology pins.
- Added `src/data/normalize.mjs`: exact USD parsing, source/token/schema checks, RPC block corroboration, hour validation, separate fetch/indexing age and block lag, normalized v1 output.
- Four initial test groups pass with `node --test test/data/normalize.test.mjs`. Both `python3 scripts/planning/validate_phase0.py` and `node scripts/planning/validate_source_contracts.mjs` pass after fixture/registry alignment. These initial tests do not complete G-01–G-05.

Remaining required work:

- [ ] Complete adversarial normalization coverage, strict normalized-input and update-field validation, bounded mapper, and fallback/recovery state machine.
- [ ] Implement bounded network retries/timeouts and CLI preflight with sanitized evidence and live RPC provenance.
- [ ] Integrate unsigned bounded requests into actual controller handling; prove protected configuration unchanged and expiry enforced on-chain.
- [ ] Implement F2 stage runner with live pair, quote effect, canonical-token safe fill, guard-specific unsafe failure, stale/malformed injection, TTL fallback, and recovery.
- [ ] Test intermediate component/E2E boundaries, retry limits, failed-source behavior and property boundaries; wire deterministic CI and explicit live-proof workflow.
- [ ] Run affected regressions, clean reproduction, evidence audit, update shared/local checklists and commit final handoff.

Credentials: existing local `.env` is ignored and contains GRAPH_API_KEY. Invoke Node with `--env-file=.env` locally; clean clones use environment injection. Never emit credentials or key-bearing URLs. No Privy implementation or policy claim yet; Phase 3 uses a clearly labeled controlled local maker identity.
