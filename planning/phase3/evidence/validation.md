# Phase 3 validation — PASS

Completed 2026-09-08 by root, using ginger-sesame commits. F2 is PASS in the accepted local Ethereum fork with live Graph inputs. Privy remains a controlled local maker substitute; F3/F4 remain NOT RUN.

Validated final runtime revision: `86091fd67a9cd7818cf5ddfdd6e3cf472194f851`. A fresh archive plus original Git metadata reproduced locked dependency and verified Foundry installation without copying node_modules, build output, or environment files. Credentials were injected through Node's explicit external env-file argument. The clean checkout is `/tmp/counterweight-p3-clean-8nmno83k`; it is a disposable convenience, not a required input.

Full clean regression ran at c53fcd9: 34 Solidity tests, 4,000 fuzz examples, 128 stateful sequences / 4,096 actions, five prototype CLI test groups, 13 initial data groups, two F1 CLI groups, live preflight, live F2 CLI test and standalone F2. All passed with no skips. The final code-only follow-up interrupts retry backoff at the collection deadline; the clean checkout advanced to 86091fd and reran all 14 data test groups, credentialed F2 CLI test, and standalone F2. The unrelated Solidity/F1/prototype code and dependencies are identical across these revisions; their passing results were not needlessly repeated.

## Commands and retained output

Paths below are under [validation/](validation/).

| Command | Evidence | Result |
| --- | --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund`; `bash scripts/setup/install-foundry.sh` | setup.log | PASS |
| `python3 scripts/planning/validate_phase0.py` | planning.log | PASS |
| `python3 scripts/planning/validate_upstream.py` | upstream.log | PASS |
| `forge fmt --check` | format.log (empty successful output) | PASS |
| `npm test` | deterministic.log; superseded data portion in data.log | PASS |
| `npm run test:fork` | fork.log | PASS, canonical-token F1 retained behavior |
| `node scripts/proofs/graph-preflight.mjs --out <fresh-directory>` | preflight.log, preflight/ | PASS, two qualified live source observations |
| `node --test test/data/*.test.mjs` | data.log | PASS, 14 groups including 10,001 mapper inputs |
| `node --test test/live/*.test.mjs` | live-tests.log | PASS, public F2 CLI and semantic artifact checks |
| `node scripts/proofs/f2.mjs --out <fresh-directory>` | f2.log, f2/ | PASS, 82 assertions, four settlement scenarios, three fresh two-source collections |

Live commands require GRAPH_API_KEY; local commands used `--env-file=<external ignored .env>`. Foundry was on PATH. Source-contract validation against pinned official source also passed after the D07 amendment (recorded during the initial source work); no source/dependency pin changed during final execution.

## Requirement-by-requirement result

- G-01 PASS: both shared response shapes and reversed token ordering; exact expected synthetic amounts; live query/schema/methodology/pool/token identity; normalized schema whitelist.
- G-02 PASS: malformed/missing/partial responses, invalid types, duplicate tokens, NaN/infinity/scientific/negative/extreme decimals, TVL minimum, overflow limits, and extra protected update fields. The updater constructs only the fixed controller ABI and confirms full immutable config plus digest after actual updates.
- G-03 PASS: exact source/fetch-age thresholds, block-lag threshold, future timestamps, inconsistent RPC hashes/times and snapshot blocks/hours, timestamp-absent RPC fallback. Live RPC context retained separately from fetch times.
- G-04 PASS: real stalled HTTP timeout, 429/503 handling, bounded attempt counts and 1/2-second delays, deadline cancellation during backoff, one-source outage, disagreement, startup/last-good expiry and recovery. Injected stale/malformed copies do not update state. F2 expires actual on-chain tuning, executes under fallback, then applies a newly fetched pair to the same controller with version increment.
- G-05 PASS: exhaustive finite mapper domain and disagreement boundaries, strict update field/range/version/deadline checks, actual controller effective values, full protected configuration and digest preservation. Existing S-07 isolation and settlement constraint tests remain green.
- G-06 PASS: two distinct fixed deployed CIDs on the same Ethereum chain, normalized by the same query/consumer; original responses, variables, indexed and fetched time, RPC hashes and deployment/source versions retained.
- G-07 PASS: live query -> normalization -> bounded update -> independently calculated quote/fill -> unsafe guard failure. Four canonical-token scenarios cover safe live and fallback fills plus unsafe live and fallback rejection. Failed transactions have guard-specific trace selectors, no logs and unchanged full token/allocation/allowance/controller state. F1 regression confirms the shared harness still covers both trade directions and post-transfer rollback.

## Artifact audit and limits

Inspected all four final scenario receipts, 82 named passing assertions, distinct CIDs, three live collections and explicit injection labels. Independently recomputed each live decimal volume, TVL, turnover and mapper output using Python Decimal with precision 90; all matched. Verified every final runtime/source hash in the F2 manifest against the workspace. Scanned all retained validation artifacts for the configured secret; none contained it. The final [validation manifest](validation-manifest.json) hashes all retained validation artifacts and links the exact runtime revision.

F2 Graph source reads are genuinely live; token settlement is on the accepted pinned canonical-token mainnet fork, not Ethereum mainnet. Simulated time advances and snapshot branches are explicit. Local maker signing is not Privy policy proof. Hosted CI was configured but not remotely executed. Freshness can make later runs fail or block; the runner must not relax thresholds or silently replace sources. No profitability, production-readiness or sponsor-award outcome is claimed.
