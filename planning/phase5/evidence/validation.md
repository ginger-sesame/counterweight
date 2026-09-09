# Phase 5 validation

Status: **IN PROGRESS — independent-agent reproduction pending.** P5-A and E-01–E-03 pass. The primary agent's clean F1–F4 runs and artifact audits pass; they do not satisfy E-04. E-05 final package acceptance remains pending that independent report. No missing credential, funding requirement or unresolved provider outage blocks the remaining work.

Runtime revision: `57e6e6740af652c0c9f3dc4675eb95b86d8937ea`. This revision contains the continuous F4 runner, restart reconciliation and all executable tests. Later changes to the independent artifact auditor and documentation do not change the runtime; the audit records its own SHA-256. Every retained runtime source hash was checked against Git content at this exact revision in [the gate audit](primary-clean/gate-audit.json).

## Clean setup and commands

Primary agent `/root` created `/tmp/counterweight-p5-clean-0QqrvL` using `git clone --no-hardlinks` and installed both locked npm packages and checksum-verified Foundry from scratch. The clone advanced to the runtime revision before the final suite. No `node_modules`, `.tools`, `out`, `cache`, `.env` or secret bundle was copied from the working repository. Approved credential/key/resource files were supplied through external absolute paths. The tracked handoff contains every non-secret setup requirement.

Setup logs: [root dependencies](primary-clean/setup-npm.log), [planning dependencies](primary-clean/setup-planning.log), [Foundry](primary-clean/setup-foundry.log). Node 22.22.1, npm 10.9.4, Python 3.12.3, Foundry 1.8.1 and Solidity 0.8.30 were used. Initial compilation downloaded the pinned compiler. Existing provider resources were reused; all Privy operations were serialized.

Exact command forms, in order, with the approved environment/key/journal paths supplied as documented in [the handoff](../README.md#setup-and-complete-reproduction):

```sh
python3 scripts/planning/validate_phase0.py
python3 scripts/planning/validate_upstream.py
node scripts/planning/validate_source_contracts.mjs
forge fmt --check
npm test
npm run test:fork
node scripts/proofs/f1.mjs --out artifacts/validation/f1
node --env-file=/absolute/path/to/approved.env --test test/live/*.test.mjs
node --env-file=/absolute/path/to/approved.env scripts/proofs/f2.mjs --out artifacts/validation/f2
node --env-file=/absolute/path/to/approved.env --test test/privy/*.test.mjs
node --env-file=/absolute/path/to/approved.env scripts/proofs/f3.mjs --out artifacts/validation/f3
node --env-file=/absolute/path/to/approved.env --test test/mvp/*.test.mjs
node --env-file=/absolute/path/to/approved.env scripts/proofs/mvp.mjs --out artifacts/validation/f4
python3 scripts/proofs/audit-mvp.py artifacts/validation/f4 --out artifacts/validation/f4-audit.json
node --env-file=/absolute/path/to/approved.env scripts/proofs/audit-secrets.mjs artifacts/validation artifacts/validation/secret-audit.json
```

Every final command exited 0. Two failed standalone provider attempts were preserved separately and reconciled before retry; see below. The public CLI tests also inspect semantic assertions and require zero skipped coverage, rather than trusting exit status alone.

## Results

| Boundary | Result and coverage | Evidence |
| --- | --- | --- |
| P-01–P-04 / source compatibility | PASS: arithmetic/data/authority fixtures, 38-test/14-decision mapping, upstream pins/patch, Graph SDL and Privy SDK request types | [Planning](primary-clean/planning.log), [upstream](primary-clean/upstream.log), [source contracts](primary-clean/source-contracts.log), [format](primary-clean/format.log) |
| Deterministic regression | PASS: 35 Solidity tests; 5,000 fuzz cases; 128 stateful sequences / 4,096 actions; 5 prototype CLI groups; 17 data groups; 12 operations groups including 4 restart groups | [Test log](primary-clean/deterministic.log) |
| F1 / V regression | PASS: 80 assertions, 5 settlement scenarios; both public CLI groups pass | [Manifest](primary-clean/f1/manifest.json), [CLI log](primary-clean/fork-cli.log) |
| F2 / G regression | PASS: 82 assertions, 4 scenarios, live source/fallback/recovery flow; public CLI passes | [Manifest](primary-clean/f2/manifest.json), [CLI log](primary-clean/live-cli.log) |
| F3 / O regression | PASS: 157 assertions, 52 intended provider denials, 38 signatures, 3 actual live pairs, complete alternate-method matrix; public CLI passes | [Manifest](primary-clean/f3/manifest.json), [CLI log](primary-clean/privy-cli.log) |
| F4 / E-01–E-03 scenario | PASS: 97 assertions, 8 continuous settlement attempts, 3 actual live pairs, intended policy/auth denials, process restart and final recovered fill; public CLI passes | [Manifest](primary-clean/f4/manifest.json), [CLI log](primary-clean/mvp-cli.log) |
| Arithmetic / evidence audit | PASS: 37 F4 runtime source hashes; independent Decimal Graph mapping, integer quote-floor intervals, projected rejected exposures, actual token deltas, continuous history and checkpoint identity | [Audit](primary-clean/f4-audit.json), [five rejected artifact mutations](primary-clean/audit-mutation-tests.json) |
| Secret scanner validation | PASS: public content accepted and six synthetic secret/raw-signature cases rejected, without printing secret values | [Seven scanner controls](primary-clean/secret-scanner-tests.json) |
| E-04 | PENDING: explicit permission to spawn the independent reviewer, then actual clean reproduction | [Assignment](../INDEPENDENT_REPRODUCTION.md) |
| E-05 final acceptance | IN PROGRESS: collected artifact scan/hash/identity checks pass; independent report must be added and final audit repeated | [Artifact index](validation-manifest.json) |

F4 retains one epoch, one canonical order and strictly increasing transaction blocks. The initial 14 WETH/12,000 USDC allocation accepts 200 USDC input and rejects 0.5 WETH input with `ExposureOutOfBounds`. A previously executable quote is rejected after another real fill changes inventory. The forced output-transfer failure rolls back two preceding successful input transfers. Stale input cannot update state; on-chain tuning expires to bounded fallback and recovers through actual fresh data. Emergency pause blocks execution, the owner resumes, revoked updater signing is denied, and restored authorization permits a fresh update and final successful guarded fill.

The public restart checkpoint is written before broadcast. A separate process with no supplied Privy credentials finds the canonical receipt and reports `DO_NOT_REPEAT`, with unchanged maker nonce, signature count and strategy state. Unit tests cover missing/pending transactions, transport failures, failed receipts, changed chain/history/code/configuration and expired/future fetch timestamps. Fetch-age acceptance alone never authorizes reuse: the result requires collecting and validating a new pair for every new update.

## Preserved failed attempts

- [F3 timeout](checkpoint/f3-timeout/f3.log): the standalone evidence run timed out after local setup and before its first integrated Graph update. [Partial evidence](checkpoint/f3-timeout/f3/failure.json) is FAIL, not an intended denial. [Readback](checkpoint/f3-timeout/timeout-readback.json) verified original owner keys, 2-of-3 threshold, enrolled signers, bounded policies and no pending resource creation. The fresh retry passed the full matrix.
- [F4 timeout](checkpoint/f4-timeout/f4.log): timeout during existing-resource provisioning before fork/output setup. [Retry check](checkpoint/f4-timeout/retry-check.json) confirmed the existing-resource path performs reads and no uncertain resource creation was retried. The fresh retry passed 97 assertions.

These are retained provider-availability failures, not changes to scope or substitutes for the final PASS runs. No runtime constraint, assertion or timeout was weakened to obtain a pass.

## Limits and outstanding completion

Execution uses canonical Ethereum tokens on the accepted local fork, chain 31337. F3's supported-network batch negative uses an unsponsored empty Sepolia account and must be denied without a public transaction. All positive transactions remain local. The static reference valuation and completed-day activity signal do not establish profitability, a live execution-price oracle or production readiness. All development owner keys remain in one approved environment; independent administrator custody is not claimed.

The primary clean reproduction and read-only restart subprocess cannot substitute for another agent. Execute [E-04](../INDEPENDENT_REPRODUCTION.md), add its report/artifacts, compare semantics, repeat the final package scan/hash audit, and only then close P5-B and Phase 5.
