# Development operations runbooks

These procedures apply only to the accepted local fork and the existing development Privy wallet. They do not authorize production transactions. All owner keys share one environment under the user's development authorization. Lost owner quorum has no application backdoor.

## Before a run

Load the existing owner-only key bundle and journal; verify app identity, wallet owner, threshold 2, three distinct owner public keys, and separate updater/emergency quorums. `privy-preflight.mjs` checks app access; it is not full policy commissioning. `privy-setup.mjs` reuses and verifies journaled resources. F3 configures controller-bound policies only after the fresh controller exists. Use `configureSigners` for exact rule/ownership/readback validation. Do not hand-edit a policy destination without verifying the deployed controller and its immutable configuration.

Check the RPC chain ID is 31337, the expected pinned Ethereum fork hash and canonical token identities. Refuse concurrent runs using the same Privy wallet. No mainnet broadcasts or real funds are required. The maker's test ETH and canonical tokens exist only in the disposable fork; owner signing is nevertheless real Privy authorization.

## Emergency and signer revocation

1. Emergency key signs only `pause()` for the currently bound controller with zero value and chain 31337. Validate recovered wallet and every requested field, then broadcast to the verified local RPC.
2. Confirm receipt, paused state and tuning-version change. Quote/fill must fail while paused.
3. Owner quorum removes the compromised updater from `additional_signers`. Read back the wallet and verify its absence. New signing must fail at authorization, not a network or malformed-request boundary.
4. Inventory all known signed hashes and pending nonces. Revocation cannot erase an existing signature. A previously signed update is rejected while paused; after resume its old expectedVersion must reject. Expiry is another on-chain bound, not a substitute for checking pause/version.
5. Obtain fresh source observations and read immutable config, allocations, physical backing, active epoch and version. Resume only through owner quorum after the contract's inventory/expiry checks can pass. Restore/re-enroll a trusted updater with the exact restricted override policy; verify wallet readback.
6. Apply a fresh bounded update and confirm safety digest/config unchanged. Do not replay a cached Graph update or presume a pending signature was revoked cryptographically.

F3 exercises this flow with actual provider removal/restoration and two pre-signed updates: one broadcast while paused and one after resume. Both must revert at their named contract boundary without strategy-state changes. Gas/nonce changes from reverted transactions are outside the protected strategy snapshot.

## Owner rotation and liquidity recovery

For planned rotation, keep a surviving authorized quorum throughout. F3 temporarily replaces owner C with a new distinct in-memory key, proves A+C no longer meets the threshold and A+replacement does, then restores A/B/C in `finally` using A+B. Interrupted recovery remains possible with A+B; inspect actual membership before retry. Do not store the transient private key in evidence.

Owner recovery uses pause -> Aqua dock for both tokens -> verify zero allocations -> owner-authorized treasury transfer or fresh epoch commissioning -> verify funding/approvals/config -> resume. Pausing before withdrawal is an owner procedure; the broad commissioning policy does not itself enforce that sequence. Restricted operators cannot dock, approve, transfer, deploy replacements or edit policies/quorums. Safety fields and existing code are immutable; changes require a new epoch/router/hash and policy retargeting. Outstanding quotes are version/epoch bound.

## Restart, uncertain responses and cleanup

For uncertain remote creation, retain the journal's `pending` record. Read provider resources and reconcile the returned resource ID before any retry; never discard the record to create another wallet/quorum. Public resource IDs are necessary recovery metadata.

For an uncertain broadcast, reconcile the exact known signed hash: receipt means return the existing result; pending transaction means wait for that receipt; absent transaction requires exact pending nonce equality before sending those same signed bytes. An RPC/network error is not evidence of absence. Never obtain another signature automatically after an uncertain send. F3 verifies receipt reuse without another nonce increment; component tests cover nonce drift and unavailable RPC behavior. This is an in-memory adapter, not a durable transaction service. After process loss, use retained public hashes to investigate chain state before a fresh operation; raw signed bytes are deliberately not persisted.

On normal completion the runner stops its own Anvil process. It retains the approved Privy wallet, quorums and policies for future runs, with original owner membership and both restricted signers restored. Do not delete keys or remote resources as routine cleanup. Read back actual owner membership/signers after any interrupted test. A temporary policy investigation must restore its original full rules in `finally`; never broadcast a diagnostic signature generated under altered restrictions.

## Evidence interpretation

`privy-signatures.json` records recovered wallet, public request and signed transaction hash; the sign-only API does not provide a separate durable operation ID. `privy-operations.json` records provider status/code/reason, HTTP correlation identifier (`x-request-id` or Cloudflare `cf-ray`), unchanged chain snapshot and relevant remote-resource snapshots. A Cloudflare ID is HTTP request correlation, not a Privy transaction ID.

`transactions.json` and contract traces establish actual receipt outcomes. `graph.json` retains three independently fetched live pairs plus mapping and RPC provenance. Synthetic diagnostics are explicitly FAIL. Minimum F3 PASS and complete Phase 4 matrix are distinct statuses until alternate RPC methods have the intended live denial evidence.
