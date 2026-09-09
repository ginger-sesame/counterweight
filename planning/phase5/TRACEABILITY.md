# Integrated validation ledger

Status: IN PROGRESS. The primary clean runs and audits pass at runtime `57e6e67`; [validation](evidence/validation.md) links the evidence. Independent reproduction remains pending. Historical Phase 1–4 results remain available in their phase handoffs. This ledger must not promote a missing independent reproduction to PASS.

| Required coverage | Executable / artifact contract | Final integrated result |
| --- | --- | --- |
| P-01–P-04 planning / integration identity | `validate_phase0.py`, `validate_upstream.py`, `validate_source_contracts.mjs`; exact dependency and source hashes | PASS — [clean validation](evidence/validation.md) |
| S-01–S-08 strategy | `npm run test:strategy`, `npm run test:e2e`; boundary/fuzz cases and compiled CLI behavior | PASS — [clean validation](evidence/validation.md) |
| V-01–V-07 settlement | `npm run test:integration`, `npm run test:invariant`, `npm run test:fork`, retained F1 | PASS — [clean validation](evidence/validation.md) |
| G-01–G-07 data | `npm run test:data`, `npm run test:live`, retained F2; current two-source daily contract, bounded mapping, fallback/recovery | PASS — [clean validation](evidence/validation.md) |
| O-01–O-07 authority | `npm run test:operations`, `npm run test:privy`, retained full-matrix F3; real restricted signer and valid denied requests | PASS — [clean validation](evidence/validation.md) |
| E-01 integrated primary direction | `npm run test:mvp`, retained F4; one epoch, live update, 200 USDC safe fill, 0.5 WETH guard rejection, actual updater policy denial | PASS — [97-assertion clean F4](evidence/primary-clean/f4/manifest.json) |
| E-02 failure recovery | Same F4; stale fetch rejection, expiry fallback/fresh recovery, old quote versus changed inventory, output-transfer rollback, emergency pause/owner resume, revoked updater/re-enrollment | PASS — [97-assertion clean F4](evidence/primary-clean/f4/manifest.json) |
| E-03 process restart | `test/operations/reconcile.test.mjs`, F4 child process and public checkpoint; receipt, nonce/signature stability, provenance and uncertainty handling | PASS — [97-assertion clean F4](evidence/primary-clean/f4/manifest.json) |
| E-04 independent reproduction | Second agent follows tracked README with approved external credential files; records clean setup and semantic comparison of F1–F4 | Pending explicit delegation authorization and execution |
| E-05 evidence integrity | `audit-mvp.py`, `audit-secrets.mjs`, hashes and requirement review; exact runtime/source identity, independent arithmetic and artifact scan | IN PROGRESS — collected evidence audited; E-04 report still required |

The complete individual S/V/G/O requirement descriptions remain in [the canonical 38-test ledger](../phase0/TRACEABILITY.md). This table adds integrated-revision validation without replacing those scope definitions.

Required evidence packaging: validation report, clean setup and test logs, retained F1/F2/F3/F4 manifests and artifacts, independent arithmetic report, credential-aware scan, immutable artifact hash manifest, independent-agent report, and sponsor-specific artifact indexes. Hosted CI configuration is not a hosted execution result. Public deployment, production custody and profitability are not claimed.
