# Privy proof bundle

Actual development organization wallet with distinct-key 2-of-3 owner authorization, separate updater/emergency quorums and self-contained restricted policies. All owner keys are intentionally held in one approved development environment; independent administrator custody is not established.

- [F3 manifest](../evidence/primary-clean/f3/manifest.json): complete matrix, 157 assertions, no omitted methods and local positive-transaction environment.
- [F3 configuration](../evidence/primary-clean/f3/privy-configuration.json), [decoded signing records](../evidence/primary-clean/f3/privy-signatures.json), [52 denied operations](../evidence/primary-clean/f3/privy-operations.json): exact roles, policies, request identities, intended policy/authorization codes and unchanged state. Raw signed transactions and private keys are excluded.
- [F3 recovery traces](../evidence/primary-clean/f3/privy-recovery-traces.json) and [final configuration](../evidence/primary-clean/f3/privy-final-configuration.json): pending-operation pause/version invalidation and original quorum restoration.
- [F4 operations](../evidence/primary-clean/f4/operations.json), [configuration](../evidence/primary-clean/f4/configuration.json) and [final state](../evidence/primary-clean/f4/final-state.json): actual forbidden updater pause, revoked updater denial, owner recovery, exact policy readback and resumed guarded settlement.
- [Restart result](../evidence/primary-clean/f4/restart.json): separate read-only process, canonical receipt reuse, no repeated signature or nonce increment.

Reproduce the full credentialed F3 and F4 commands in sequence. Never run them concurrently against this wallet. All positive signatures/transactions are constrained to local chain 31337. The supported-network batch negative uses an empty Sepolia account, zero self-call and no sponsorship, and must be denied without moving funds. Provider policy denial, authorization denial and on-chain guard rejection are distinct evidence categories.
