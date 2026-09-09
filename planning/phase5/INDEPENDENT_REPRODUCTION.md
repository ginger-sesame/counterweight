# E-04 independent reproduction assignment

Status: PENDING. The primary agent has requested authorization to delegate this bounded verification. Do not treat the primary agent's clean checkout or the restart subprocess as an independent-agent reproduction.

The reviewer should use [the Phase 5 setup commands](README.md#setup-and-complete-reproduction) and tracked technical contracts. Start in a fresh clone, record the exact revision, install locked dependencies and Foundry, and use only explicitly supplied external credentials/key/resource files. Do not copy `node_modules`, `.tools`, `out`, `cache` or hidden configuration from the primary workspace. Global Node/npm/Python and the supplied credential paths are documented prerequisites.

Run the complete deterministic suite, specification/upstream/source checks, F1/F2/F3/F4 public CLI tests and retained proofs. Serialize the actual Privy wallet operations with the primary agent. The full F3 matrix is required; diagnostic/synthetic runs cannot pass. Keep failed attempts with their actual classifications and investigate before retrying. Do not modify the required assertions or market-data period to obtain a pass.

Compare semantic outcomes against the primary validation:

- Every required test completes with no skips. F1 verifies real canonical-token deltas and atomic guard/settlement rejection.
- F2 consumes two distinct pinned live deployments, with completed-day windows and bounded tuning; stale/fallback/recovery checks pass.
- F3 reports the complete provider-method matrix, intended denial classifications/correlation IDs, original owner quorum restoration and bounded signer policies. Positive transactions remain local; the unsponsored, empty-account Sepolia batch request must be denied.
- F4 uses one epoch and uninterrupted increasing blocks. It starts with 14 WETH/12,000 USDC, accepts 200 USDC input, rejects 0.5 WETH input, proves actual policy denial, stale/inventory/settlement/pause/revocation recovery, and ends with a successful guarded fill after recovery. The separate read-only process must reconcile the update without another signature or nonce increment.
- Run the independent arithmetic and credential-aware artifact audits. Never include secret material or executable raw signed transactions in the report.

Return a tracked or reviewable report with reviewer agent identity, UTC start/end, clean checkout provenance, exact setup/test commands and exit statuses, gate/assertion counts, semantic comparison, artifact paths/hashes, any deviations and unresolved limitations. Transaction hashes, random run IDs, addresses of fresh deployments and market values may differ. A clean result does not establish public deployment, production readiness or independent owner-key custody.

If a documented step is insufficient, report the concrete missing prerequisite or instruction. Do not fill it from hidden primary-agent state and still call the run independently reproducible.
