# Phase 4 agent handoff

Status: IN PROGRESS. F3 and O-01–O-07 remain unproven. Scope is the full Phase 4 permission matrix, actual provider enforcement, Graph-to-settlement under Privy, emergency/recovery/revocation and pending-signature behavior, clean regression and logical commits.

The user authorized generating all three development owner keys in one environment. [D09 amendment](../phase0/OPERATIONS.md) replaces independent custody for this demo only; still require distinct P-256 keys and actual 2-of-3 provider authorization. Five distinct local authorization keys (three owners, updater, emergency) are stored in ignored `.secrets/privy-development.json`, mode 600. No remote wallet or quorum is yet known to have been created. Existing app credentials remain in ignored `.env`.

Implemented initial work:

- Root dependency pinned to `@privy-io/node@0.34.0`, matching the previously reviewed SDK.
- `src/operations/keys.mjs`: generate/validate distinct P-256 role keys; exclusive creation, regular-file and owner-only load checks; no silent overwrite.
- `test/operations/keys.test.mjs`: actual key derivation, role duplication/mismatch rejection, persistence, overwrite refusal and permission checks pass.
- `scripts/proofs/privy-preflight.mjs --out <fresh-directory>` performs read-only wallet listing with explicit 10-second timeout and no SDK retries. Artifacts expose only status/classification/count/revision, not SDK error objects or credentials. Run with `node --env-file=.env` locally.

Initial direct Node and curl attempts to `https://api.privy.io/v1/wallets?limit=1` timed out without an HTTP response. This does not establish invalid credentials or policy denial. Recheck connectivity before remote provisioning; continue independent adapter and deterministic test work in the meantime. A missing live result cannot pass F3.

Next steps:

- [ ] Confirm app authentication; inspect current remote resources before provisioning, especially after an interrupted request.
- [ ] Create and journal/read back actual owner/updater/emergency quorums, materialized policies and wallet; make provisioning resumable without duplicate or lost resources.
- [ ] Implement signed-request adapter, decode/recover returned transactions, local-chain broadcast and nonce/receipt reconciliation.
- [ ] Parameterize shared settlement setup for actual Privy maker/owner commissioning; prohibit impersonating the maker as a substitute for Privy proof.
- [ ] Complete O-01–O-07 positive/negative matrix, policy-specific wrong-target denial, owner-only management, emergency pause, authorized resume, signer revocation/rotation and pending signature handling.
- [ ] Run live Graph through real restricted signing to canonical-token settlement, inject failures, retain sanitized proof and independently audit it.
- [ ] Regress F1/F2 and deterministic suites; clean reproduction, docs/checklists and evidence commits.

Primary docs checked 2026-09-08: [programmable controls](https://docs.privy.io/controls/authorization-keys/owners/configuration/programmable), [sign transaction API](https://docs.privy.io/api-reference/wallets/ethereum/eth-sign-transaction). They describe quorum threshold and per-signer override policies; actual enforcement must still be demonstrated for this app.

Update: app authentication is now confirmed PASS in [read-only preflight](evidence/app-preflight.json), with no existing wallets in the first page. Requests with `?limit=1` repeatedly timed out while default-page requests succeeded, including through the pinned SDK; preflight now uses default pagination. This is an observed endpoint behavior, not evidence of invalid credentials. Proceed with remote provisioning.

Provisioning update: three remote quorums, owner policy and Ethereum wallet have been created and read back. Their IDs and ownership are journaled in ignored `.secrets/privy-resources.json`. Private keys remain in the separate owner-only key bundle. The owner quorum successfully signed actual WETH funding, contract deployment, approval/shipping, and safe canonical-token settlement in `artifacts/p4-owner-commissioning-typed`. That diagnostic run deliberately exits FAIL at its incomplete permission-proof checkpoint; it is not F3 PASS.

The signing adapter validates recovered wallet, chain, type, nonce, destination, calldata, value, gas and fee fields before broadcasting. Live integration exposed two wire requirements: quantity strings must be hexadecimal, and transaction type must be explicit (omission can change a legacy request to EIP-1559). Both are corrected and covered by mutation/legacy tests. Provisioning uses bounded display names, exclusive key persistence, and a pending-creation journal; uncertain remote creation requires reconciliation before retry. Policy materialization/attachment and initial restricted signer proof are in progress.

Current integration checkpoint: `scripts/proofs/f3.mjs` uses the actual Privy wallet as both deployer and maker via the shared settlement harness. Owner signing/settlement works; F1 regression still passes (two CLI groups). Six operations test groups pass. The F3 runner intentionally cannot claim PASS yet and currently stops at the valid updater request because the full ABI-argument policy denies it.

Live policy diagnosis: updater authorization succeeds with chain_id, exact destination, zero value and function_name conditions. Adding the first `setTuning.intensityBps >= 0` condition produces policy_violation for valid (900,28) input; the other argument-bound conditions also need investigation. Removing any single condition from the full policy does not restore acceptance. Checksummed destination, numeric request zero, hexadecimal condition values and alternate argument paths did not resolve it. Numeric policy values are rejected by this API (string/array required); param-only/lowercase/positional field paths are invalid policy formats. Official docs prescribe the existing `function.argument` path. All temporary diagnostic policy modifications were restored in finally blocks; no diagnostic signature was broadcast. Keep the full bounds, investigate the provider's ABI integer handling, and do not count a denial of the intended allowed request as O-03 success. Diagnostic outputs are in ignored artifacts/p4-policy-*.json. Remote signer array ordering is unstable; readback comparison now canonicalizes by signer ID.

Remote resource journal is authoritative and contains owner/updater/emergency policies and attached signer IDs. Do not recreate these resources or keys. Default Privy API pagination works. Current `privy-setup.mjs` reads back the existing wallet and identities; provisioning with a pending unknown creation deliberately refuses automatic retry.
