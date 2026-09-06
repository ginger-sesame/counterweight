# Phase 1 validation and completion audit

Status: PASS — P1-A/P1-B and S-01–S-08 completed, including clean reproduction. Run date: 2026-09-06. Agent: root/Codex. Boundary: deterministic Solidity and isolated Anvil simulation. F1–F4 remain NOT RUN.

Implementation revisions: `72e26af` (core/unit and property tests), `cb44202` (CLI, E2E, additional boundary checks, installer and CI). Source hashes and exact artifact identities are recorded in `manifest.json`; documentation-only updates after these revisions do not change the tested runtime.

## Required evidence

| Requirement | Evidence and acceptance |
| --- | --- |
| P1-A toolchain/setup | `setup.log`; Node 22.22.1/npm 10.9.4, Python 3.12.3, verified Foundry 1.8.1 archive, Solidity 0.8.30, exact root lockfile. Fresh `npm ci`, no ignored local dependencies. |
| S-01–S-05 economic and boundary behavior | `tests.log`; 14 Solidity tests including 16 original quote examples, nine exact exposure classifications, both input caps and adjacent units, configuration/envelope/mode errors, physical backing, epoch boundaries, valuation and allocation changes. Detailed function mapping in the handoff checklist. |
| S-06 independent invariant | `tests.log`; 1,000 cases each for guard classification and accepted quote projection. Independent allowable-WETH ceil/floor interval, full input/output balance deltas, using the actual quote including spread and rounding. |
| S-07 tuning isolation | `tests.log`; 1,000 arbitrary uint16 intensity/spread/availability cases, invalid fallback and cap assertions, unsafe fill rejection, same direct guard input unaffected by tuning, unchanged digest and absent mutation selectors. |
| P1-B / S-08 public E2E | `tests.log` and `prototype.json`; five Node test groups invoke the actual public CLI subprocess. Positive/negative outcomes both directions, missing/adversarial fallback, invalid constructor config, schema errors, intentionally wrong expected output, empty fixture rejection, unsupported RPC flag, missing build tool. |
| Standalone runner output | `prototype.json`; 24 scenarios through compiled Solidity: 16 normal fixed examples plus two directions × two fallback regimes × accepted/rejected. Accepted post-balances meet an independently calculated invariant. Named guard rejections retain starting projected balances. Safety digests match. |
| Earlier specification regression | `planning-check.log`; P-02 original arithmetic (16 quote/9 boundaries), P-04 data/policy tabletop, P-01 package integrity. This does not rerun or claim live provider proofs. |
| Formatting | `format.log`; `forge fmt --check` succeeds. Empty output is normal on success. |
| CI | `.github/workflows/validate.yml` installs verified tools and locked dependencies, runs format/specification/strategy/E2E/standalone checks and uploads artifacts. These commands are validated locally; hosted GitHub Actions execution is not claimed. |
| Clean reproduction | Fresh Git-index archive with no node_modules, out/cache, `.tools`, `.env`, `docs/`, AGENTS.md or Git metadata. Followed README setup and commands. A null Git revision in the archive report is expected; source/lockfile hashes bind it to the committed implementation. |

## Audit notes and limits

The 3,000 property trials supplement fixed independently derived examples; they are evidence of tested behavior, not exhaustive mathematical verification. No fixtures were changed to fit implementation results. The test-only math harness exposes intermediate output for cases rejected by the public pipeline.

Code review checked constructor-only safety storage, typed bounded tuning, no external call/delegatecall/transfer surface, exact guard arithmetic, single final output rounding, and check ordering. With supported envelopes, products fit uint256. The Phase 0 explanatory upper bound was corrected from 10^47 to below 2×10^52; the accepted envelope/formulas did not change. Existing Phase 0 manifest hashes are historical evidence for that earlier revision; current Phase 1 hashes cover updated files.

Rejected projections are simulation results from read-only calls. They do not establish rollback of token settlement. The prototype does not implement Aqua/SwapVM, quote envelopes, controller tuning TTL/versioning/pause, Graph normalization/live queries or Privy restrictions. Those remain explicit Phase 2–5 deliverables. No remote CI run, external deployment or provider proof is claimed.

All retained artifacts contain local public test identities/configuration and deterministic fixtures. No credentials, private keys, authorization headers or external RPC secrets are required by this suite. The runner suppresses Anvil startup account/key logs.
