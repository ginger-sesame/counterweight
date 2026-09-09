# Phase 4 agent handoff

Status: BLOCKED on a qualifying current two-source Graph pair. The main F3 path previously passed with actual Privy signing and live Graph data. All alternate-method request prerequisites are now resolved and required in normal F3 coverage. Final full-matrix live and clean F3 proof is still required; current Sushi completed-hour data is unavailable. Do not mark the phase exit complete from a synthetic permission diagnostic. F4 remains NOT RUN.

## Implemented boundary

The existing Privy Ethereum wallet is the actual maker and deployer on the accepted canonical-token Ethereum fork, chain 31337. Owner commissioning uses two distinct P-256 authorization keys. Updater and emergency signers each have a separate key quorum and self-contained override policy. The user authorized all three owner keys to be held in this development environment; this proves threshold mechanics, not independent administrator custody.

- `src/operations/keys.mjs`: five distinct keys, matching public/private derivation, exclusive persistence and owner-only file checks.
- `provision.mjs`: journaled remote creation, pending-request reconciliation, ownership/quorum/owner-policy readback. Never automatically retry uncertain resource creation.
- `policies.mjs`: materialize exact controller bindings, checksummed addresses, exact rules and owner/version verification; attach and verify signer overrides.
- `signer.mjs`: explicit local chain, nonce, transaction type and hexadecimal quantities; recover and compare returned transaction fields before broadcasting; reconcile hash/receipt/pending nonce before broadcast retry.
- `scripts/proofs/f3.mjs`: actual owner commissioning, Graph/updater consumption, guarded fills, policy denials, administration denials, pause/revocation, pending transactions, resume, quorum rotation, policy retargeting and owner recovery.

Only the canonical-token funding pool is impersonated. The Privy maker is not impersonated. Local taker keys execute trades using their own funds. Raw Privy signed transactions stay in memory; retained artifacts contain public request fields and hashes.

## Credentials and repeatable commands

Existing credentials are in ignored `.env`. Five keys are in `.secrets/privy-development.json` and the authoritative resource journal in `.secrets/privy-resources.json`, both mode 600. Reuse these files; never regenerate keys or recreate resources to bypass a failed request. Their contents are not published with evidence.

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/setup/install-foundry.sh
export PATH="$PWD/.tools/foundry:$PATH"
node --env-file=.env scripts/proofs/privy-preflight.mjs --out artifacts/new-privy-preflight
npm test
node --env-file=.env --test test/fork/*.test.mjs
node --env-file=.env --test test/live/*.test.mjs
node --env-file=.env --test test/privy/*.test.mjs
node --env-file=.env scripts/proofs/f3.mjs --out artifacts/new-f3
```

Each output directory must be fresh. F3 can use absolute `PRIVY_KEYS_FILE` and `PRIVY_RESOURCES_FILE` paths for a clean checkout, plus Node's external `--env-file` option. Serialize every process using this wallet: F3 retargets remote policies and temporarily rotates/revokes signers. The final controller is an isolated upper-bound branch; the next run deploys a fresh initial branch and retargets both policies again.

`CW_PRIVY_DIAGNOSTIC=1` substitutes synthetic tuning to isolate permission/recovery checks during a Graph outage. It always fails at the final checkpoint and cannot pass F3. Every normal F3 run requires all applicable alternate-method denials; there is no flag to omit them. Batch denial uses an empty Sepolia account, a zero-value self-call and sponsor:false so provider preparation can reach policy evaluation. The proof requires policy_violation plus unchanged testnet balance/nonce; all positive signing and settlement stays on chain 31337. Sepolia RPC access is an additional read prerequisite.

GitHub Actions has an explicit credentialed Privy job with serialized wallet access. It requires GRAPH_API_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET, optional ETHEREUM_RPC_URL, and approved PRIVY_KEYS_JSON/PRIVY_RESOURCES_JSON secrets. Hosted CI has not been executed. Its artifacts exclude credential files; provisioning updates still need reconciliation with the authoritative local journal after interrupted runs.

## Known integration findings

1. Default Privy wallet-list pagination succeeds; `?limit=1` repeatedly timed out. Preflight uses the working default SDK pagination.
2. Explicit transaction type and hex quantity strings are required for faithful wire encoding. Every returned signature is independently decoded and recovered.
3. Live policy argument checks rejected valid uint16/uint32 tuning inputs and accepted uint64/uint256. The actual ABI uses uint256 for intensity/spread and checks the original bounds before narrowing storage. Oversized inputs cannot truncate into allowed values. This changes the selector, requiring fresh epoch deployments. See [width probe](evidence/argument-width-probe.json).
4. The Graph nested token relation timed out. [DATA_COMPATIBILITY.md](DATA_COMPATIBILITY.md) records the exact snapshot-ID query and RPC token-identity replacement, preserving both sources, completed-hour requirements and freshness bounds. Missing completed-hour snapshots are unavailable data, never zero volume.
5. Alternate RPC request prerequisites were resolved against the actual provider. `eth_sendTransaction` needs explicit nonce/gas/fees/type to avoid private-network preparation before policy evaluation. User-operation calldata must wrap the target call in the supported Alchemy account's `execute(address,uint256,bytes)`; direct controller calldata returned invalid_data, which did not count as a denial. `wallet_sendCalls` requires a supported network for preparation; empty-account, zero-value, unsponsored Sepolia requests returned policy_violation for both restricted roles with unchanged balance/nonce. The [method probe](../../scripts/proofs/privy-method-probe.mjs) reproduces these public request shapes, and F3 requires the actual denials. No policies were weakened. Prior malformed/network failures remain historical diagnostics, never passing policy evidence.
6. Sushi's hourly snapshots are event-driven and some hours have no entity. A fresh indexed head does not establish that the completed-hour observation exists. Historical pool review confirms gaps; do not infer zero volume, use an older hour, backdate the clock or substitute a different pool silently. Final live acceptance waits for a genuinely qualifying current pair.

## Next agent deliverables

- [x] Provision and read back actual wallet, three quorums and full policies.
- [x] Verify adapter signatures and reconcile repeated broadcast by receipt/hash/nonce.
- [x] Exercise pause, revocation, stale pending transactions before and after resume, and owner member rotation/restoration against actual Privy.
- [x] Resolve alternate-method proof preconditions without weakening restrictions; retain actual policy denials and separate earlier malformed/network failures. Batch negative requests require an empty testnet account, no sponsorship and unchanged balance/nonce.
- [ ] Run the complete permission matrix in normal F3, then clean credentialed CLI and retained F3 proofs.
- [ ] Independently audit evidence hashes, live data math, signatures, token deltas and final remote state; update all O checkboxes only when their full cases pass.
- [ ] Complete clean reproduction and evidence packaging, synchronize local docs/traceability, commit the final Phase 4 exit. F4 is a separate next phase.

See [RUNBOOKS.md](RUNBOOKS.md) for incident handling and restart requirements. Historical Phase 3 proof remains tied to its original source revision and query. The checkpoint evidence must distinguish successful core coverage from unresolved full-phase requirements.
