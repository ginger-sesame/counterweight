# Phase 0 clean-checkout reproduction

Date: 2026-09-06T22:37:19.717829+00:00. Reviewer: root agent.

Archived staged Git tree `a9f966554d4003a3e60400817510cac9769d147e` to a fresh directory with `git archive`. Confirmed ignored docs/ and installed node_modules were absent. Ran the documented commands from that directory:

- `python3 scripts/planning/validate_phase0.py`: PASS, all arithmetic/data/authority/package checks.
- `npm ci --prefix scripts/planning --ignore-scripts --no-audit --no-fund`: PASS, 28 packages installed from the lockfile.
- `node scripts/planning/validate_source_contracts.mjs`: PASS, source registry/schema, negative query mutations, three policies, wallet/quorum types, calldata roundtrip and salted-program checks. Source digests match retained source-validation.json.
- Original default RPC preflight: HTTP 403 on historical token read, reproduced on retry. This is an availability failure, not a successful test.
- `ETHEREUM_RPC_URL=https://eth-mainnet.public.blastapi.io python3 scripts/planning/probe_rpc.py`: PASS, same chain/block hash, token identities/decimals, factory pools and funding balance.

Changed the public default to the verified alternate and updated the proof documentation. Copied that final script into the clean checkout and reran its default command: PASS. No other executable/source fixture changed after this clean-source reproduction. The final validation manifest records exact current input hashes; the initial archived tree is recorded separately rather than falsely claiming it included this final default change.

This is Phase 0 reproducibility proof. It does not mark future E-04 (independent reproduction of the implemented MVP) complete. All F1–F4 and application tests remain NOT RUN.
