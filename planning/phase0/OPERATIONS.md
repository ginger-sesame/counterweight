# D09–D10: organization control and authority

Decision: root agent, 2026-09-06. Use a Privy Ethereum organization wallet owned by a 2-of-3 authorization-key quorum controlled by treasury administrators. No single application server owns the wallet. Additional signer policies restrict a configuration updater and an emergency signer. The runtime process has no authorization key and can only read, request quotes, and broadcast already-authorized transactions. Takers are separate wallets; they trade against the guarded liquidity, not as treasury operators.

Phase 0 specifies this ownership arrangement; no real organization, quorum, or wallet has been created. Administrator key custody must be independent in the live proof, not three copies of the same server secret. SDK/REST wallet ownership and per-signer policy support were verified from primary docs/declarations; actual acceptance and denial remain F3.

## Authority and enforcement matrix

A=allowed, D=denied. Owner means the full 2-of-3 quorum, never one administrator. Deployer is a commissioning duty performed by that quorum, not a permanent runtime privilege.

| Action | Owner/deployer quorum | Updater signer | Emergency signer | Runtime/no signer | Taker | Enforcement / tests |
| --- | --- | --- | --- | --- | --- | --- |
| Deploy immutable epoch/router | A in commissioning | D | D | D | D | Privy owner authorization; policy signing target/method constraints; O-01/04 |
| Ship/dock strategy; ERC20 approve Aqua | A | D | D | D | D | maker wallet signature and Privy policy; O-01/04 |
| setTuning within envelope | A | A | D | D | D | Privy policy + contract maker address, bounds, version, expiry; O-02/03, G-05 |
| Out-of-range tuning | D | D | D | D | D | contract rejects even owner; Privy updater policy also limits values; O-03/04 |
| Change safety/price in current epoch | D | D | D | D | D | no setter, immutable storage; O-04, S-07 |
| Replace epoch/code after pause/dock | A, new address/hash | D | D | D | D | owner authority, immutable existing router, active-epoch registration; O-04/05 |
| Transfer treasury assets / widen approvals | A only with owner review | D | D | D | D | Privy owner, default-deny signer policies; pause/dock runbook; O-04 |
| Pause active epoch | A | D | A | D | D | policy function allowlist + contract maker; O-06 |
| Resume | A after checks | D | D | D | D | owner policy only, contract validates epoch/inventory; O-06 |
| Change wallet owner/policy/quorum; enroll/revoke signer | A | D | D | D | D | Privy resource owner authorization, never updater policy ownership; O-05 |
| Export key | D in MVP | D | D | D | D | no export allow rule; owner could deliberately reconfigure later; O-04 |
| Read/quote | A | A | A | A | A | public reads, no signing required; S-08 |
| Fill strategy as taker | separate funded taker only | D as treasury signer | D as treasury signer | no treasury signing | A | SwapVM guarded execution, own taker funds; V-01–07 |

Important boundary: different Privy signers on one wallet appear on-chain as the same maker address. Contracts cannot distinguish which administrator or signer authorized that wallet's transaction. Role separation is enforced by Privy request authorization/policies; immutable safety fields and tuning bounds are separately enforced on-chain. Do not claim an on-chain role check distinguishes these people.

## Policies and concrete operation shape

Use `eth_signTransaction` exclusively for restricted signer proof, then broadcast returned bytes to local Anvil chain 31337. This avoids requiring Privy to reach a private fork RPC. Deny `eth_sendTransaction`, raw message/typed-data signing, user operations, batched calls, EIP-7702 and export by absence of ALLOW rules. No wildcard ALLOW. Signatures are only for the selected chain/destination/method and zero native value.

`fixtures/updater-policy.json` is a request template using explicit `${CONTROLLER_ADDRESS}` and `${OWNER_QUORUM_ID}` placeholders, never a deployable policy until materialized and checked. Its single ALLOW rule requires all of: chain_id=31337, destination controller, value=0, function_name=setTuning, intensity in [0,1000], spread in [10,100]. ABI condition fields match actual function argument names. Only owner quorum owns/updates this policy. Its ID is attached as the updater's override_policy_ids; do not assume wallet defaults are combined with signer overrides. Restricted policies must each be self-contained.

`fixtures/wallet-create.json` and `fixtures/owner-quorum-create.json` define the setup request shapes; updater/emergency signer IDs are separate 1-of-1 authorization-key quorums. Materialize public key/ID placeholders with independently controlled keys. Create quorum, owner/updater/emergency policies, and wallet through the corresponding SDK resources, then read back and compare ownership and overrides.

The emergency policy in `fixtures/emergency-policy.json` is a separate single ALLOW rule for `pause()` to the same controller, same chain and zero value, no other methods. `fixtures/owner-policy.json` allows the full owner quorum to sign commissioning transactions only on chain 31337, with at most 20 ETH native value per operation (for WETH setup). It has no export or other RPC allow rule. Within this controlled fork the owner is trusted to select deployment/token/controller actions; pause-before-withdraw is an owner runbook constraint, not a policy condition falsely claimed to be on-chain enforced. Restricted signer overrides do not inherit this broader commissioning rule. Runtime receives no signer credentials.

The valid allowed request calls `setTuning(900,28,currentVersion,now+300)` on controller, signed by the updater through `/v1/wallets/{wallet_id}/rpc`, with chain_type=ethereum, method=eth_signTransaction, transaction chain_id=31337, to=controller, value=0, ABI calldata, explicit nonce/gas/fee fields. Broadcast to the local fork and assert tuning changes, version increments, and safety digest remains unchanged.

Primary forbidden request differs only in destination: encode the same valid setTuning against a second identically initialized controller that the same maker owns. The calldata would succeed on-chain, but its destination is not allowlisted. Run eth_call against that second controller first to prove semantic validity; then request signing with identical valid updater credentials. Assert a policy denial, no raw signed transaction, no broadcast, unchanged state/nonce/balances. Do not submit forged credentials or a knowingly reverting call and label it policy enforcement.

Also test valid calldata for pause/resume and ERC20 approve under updater credentials to prove function/asset restrictions. Some forbidden actions may independently revert on-chain; sign-only API separates those cases from broadcast simulation. Actual policy response identifiers and reason must be recorded; a network/authentication failure is BLOCKED/FAIL, not a passing denial.

## Ownership, governance and recovery

- Safety values, price, token pair, and executable code are immutable per epoch. Updating them means owner-quorum pause -> dock both tokens -> create/register new epoch -> approve/ship exact order -> validate balances -> activate. New epoch rejects previous hash/version.
- Owner/deployer keys never reside in the Graph worker or runtime environment. Production ownership recovery is not implemented here; quorum member rotation under current quorum is the MVP administration flow. Lost-quorum access cannot be solved by inventing an application backdoor.
- Pause invalidates current quote version and blocks quote/fill. Resume requires owner quorum, unexpired epoch, adequate physical backing, and valid in-bounds allocation. If already out-of-bounds recovery is needed, owner creates a fresh correctly funded epoch; runtime cannot resume around this check.
- Revocation prevents new authorization but cannot invalidate a transaction already signed. Incident flow: pause on-chain, revoke signer through owner quorum, inspect pending nonces, cancel/replace pending signed operations where possible, bump version before resumption, and wait for short operation expiry. Signed setTuning must carry expectedVersion and deadline to reject stale execution. Do not claim provider revocation retroactively cancels chain-valid signatures.
- On restart reconcile known transaction hash/nonce/receipt before any new signing. Read active order/version/tuning validity from chain; never replay a saved update automatically.

## Threat/tabletop review (P-04)

| Scenario | Expected behavior and proof |
| --- | --- |
| Two fills use one old quote | Recompute current allocation each time; second accepts only if minOutput and guard still hold; V-03/06 |
| Balance drained by another allocation | physical < allocated -> InventoryUnavailable; no transfer; S-05/V-03 |
| Quote-only/missing guard/empty program | entry validation rejects canonical hash/program mismatch, even if no opcode executes; V-05 |
| Settlement fails after first transfer | EVM reverts allocation and all token state; V-02/05 |
| Graph field attempts safety change | schema/ABI rejects, no mutable hard field, safety digest unchanged; G-02/05 |
| Provider outage / worker stops | last-good expires on-chain, fallback stays bounded; G-04/G-07/E-02 |
| Compromised updater | only bounded setTuning on one controller; cannot approve/dock/deploy/export; O-03/04 |
| Wrong Privy destination | valid request denied before signing; O-03 |
| Policy owner accidentally updater | preflight fails ownership inspection; do not operate; O-01/05 |
| Config update races quote | old expected version rejects; V-04/O-05 |
| Emergency signer attempts resume | policy denial, paused state remains; O-06 |
| Signed update broadcast after revocation | on-chain pause/version/expiry rejects according to incident sequence; O-05/E-02 |
| Restart after uncertain broadcast | receipt/nonce reconciliation; no duplicate signature; E-03 |

All of these are reviewed design outcomes in P0. None is claimed as implemented or provider-enforced until its application test passes.

## D09 development custody amendment — 2026-09-08

The user explicitly authorized the agent to generate and hold all three owner authorization keys for the development demo. Phase 4 therefore proves an actual 2-of-3 authorization threshold with distinct keys, plus restricted signer policies, while all keys are controlled in one local environment. This does not establish independent administrator custody. The original independently controlled quorum remains the production-intent model; its custody claim is excluded from the development proof. Store keys in ignored `.secrets/privy-development.json` with owner-only permissions, separate from application credentials in `.env`; never overwrite keys that may own existing resources. Updater and emergency keys remain distinct from all owner keys.
