# Integration feasibility and source record

Reviewed 2026-09-06 by root. Source links below are primary references. Qualification is a documented interpretation of published rules, not an organizer award guarantee. No credentials or external wallet actions were used in Phase 0.

## D13: sponsor baseline

Working event baseline: **ETHOnline 2026**, inferred from the exact three prize descriptions matching the original brief; event clarification was requested. If the user selects another event, recheck this decision and qualification before submission.

- [1inch prize](https://ethglobal.com/events/ethonline2026/prizes/1inch): official Aqua/SwapVM lineage, modified SwapVM allowed, token transfers demonstrated on-chain (local forks explicitly accepted), and meaningful commit history.
- [The Graph prize](https://ethglobal.com/events/ethonline2026/prizes/the-graph): meaningful standardized-schema use or product composition, live provider data, a public repository, and a 2–4 minute demo. Two arbitrary subgraphs are insufficient. Counterweight uses one Messari DEX-AMM Extended query across two protocol deployments.
- [Privy prize](https://ethglobal.com/events/ethonline2026/prizes/privy): a functional business workflow using a Privy wallet and a Privy control, working demo/source access, and a clear account of Privy's role.

F1–F3 are engineering gates, not the entire submission. Preserve early commits, demonstrate the unified treasury workflow, document pre-existing work for any continuity classification, publish the intended source when authorized, and record the short demo. The actual track/registration/publication is not performed in Phase 0.

## D05: pinned SwapVM path

| Dependency | Pin | Evidence |
| --- | --- | --- |
| SwapVM | `f09a41e689240adc645934f965c8061749397cd2` | [repository](https://github.com/1inch/swap-vm/tree/f09a41e689240adc645934f965c8061749397cd2) |
| Aqua | v1.0.0, `098b4c5d8eec67677f7ca861ca991af56024d9c5` | [repository](https://github.com/1inch/aqua/tree/098b4c5d8eec67677f7ca861ca991af56024d9c5), selected because pinned SwapVM depends on this tag; do not replace with Aqua main |
| Solidity | 0.8.30, optimizer 700, viaIR | pinned SwapVM foundry.toml |
| solidity-utils / OpenZeppelin | 6.9.10 / 5.4.0 | pinned SwapVM package.json |
| forge-std | v1.11.0 | pinned SwapVM package.json |

Source inspection:

- `src/SwapVM.sol`: quote and swap initialize Aqua balances with `safeBalances`; `swap` locks by order hash, runs VM, validates amounts, then transfers. Aqua input via transferFrom-and-push and output via pull use actual ERC-20 transfers.
- `src/libs/VM.sol`: instruction header is opcode byte plus argument-length byte. Dispatch is extensible. `ContextLib.runLoop` returns final input/output amounts.
- `src/opcodes/AquaOpcodes.sol`: `_runOpcode` is virtual. `AquaSwapVMRouter._dispatch` itself is not virtual; do not assume directly overriding that concrete method works.
- `src/libs/OpcodeList.sol`: 0xd0..0xef unallocated; select 0xd0 for Guard wrapper, 0xd1 for Skew quote. Do not consume reserved 0xf0..0xff or renumber upstream instructions.
- Aqua `safeBalances` returns allocated balances, not ERC-20 balanceOf; `ship` registers without moving tokens; `push` and `pull` move tokens; `dock` invalidates allocations. Token array must contain both assets when docking.

Selected implementation: a clearly attributed modified SwapVM base with minimal added validation hooks in BOTH `quote` and `swap`, plus a Counterweight dispatcher/immutable epoch registry. Preserve upstream transfer logic. Hooks validate supported order/trait shape at entry and final balances after swap. Upstream external quote/swap are non-virtual; the controlled source modification is intentional and must be a separately reviewed diff, not an imagined inheritance hook.

Canonical program is exactly `0xd000d100`: guard wrapper (no args) invokes remainder once, Skew computes output, wrapper validates projected balances after the quote opcode. Registration binds the entire canonical order hash, maker, tokens, epoch, safety config and program. Reject unregistered hashes, changed bytecode, extra instructions, missing/reordered guard, fee instructions, direct-signature mode and noncanonical arguments. Enforce entry validation even for an empty program, which otherwise never invokes dispatch.

Only exact-in, full amount, no native value/unwrap, maker default receiver, zero maker hooks, no taker callbacks, first-transfer-from-taker, transferFrom-and-Aqua-push, and default taker recipient are supported. Token direction is selected with the upstream builder, not hard-coded address ordering. TakerArgs carry the ACCOUNTING envelope. Require a nonempty minOutput and matching deadline. No arbitrary external callbacks or delegatecall in this program.

Before runLoop require physical balances >= allocations. After settlement assert allocation equals projected post-state and maker token deltas equal full input and quoted output. This verifies actual settlement, not just a projected guard. Failures revert atomically. Additional token semantics are unsupported; canonical WETH and USDC transfer/approval behavior is the selected scope. Upstream order-hash lock plus one registered active order per maker and disabled callbacks bounds reentrancy; test attempted reentry and altered program paths in V-05.

Phase 0 experiment: the pinned upstream `SwapVmAccounting.t.sol` compiled and all 16 tests passed under Foundry 1.8.1 / solc 0.8.30. This establishes baseline toolchain compatibility, not the custom guard or F1. See evidence/upstream-review.md.

## D06: accepted real-token environment

F1 uses Anvil chain ID **31337**, forked from Ethereum block **25917718**, block hash in evidence/rpc-preflight.json. Use actual forked mainnet token bytecode:

- WETH `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`, 18 decimals.
- USDC `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`, 6 decimals.

Read-only RPC preflight confirmed chain ID, code, decimals, factories/pools, and adequate USDC for fork-only funding. Bootstrap ETH via Anvil balance assignment, WETH via deposit, USDC via fork-only impersonation of `0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640`. Stop impersonation after transferring 25,000 USDC to maker/taker fixtures. Do not execute these funding operations on Ethereum mainnet. Never give the live Privy wallet a mainnet transaction to sign for this demo.

Deploy pinned Aqua locally and modified Counterweight SwapVM locally; their addresses are generated outputs in the run manifest, not invented predeploy addresses. Record CREATE transaction, runtime code hash, compiler/version, and constructor args; reject mismatched manifests. Set fork clock to current run UTC before opening the 30-minute epoch so live Graph observation timestamps and local expiry share a meaningful clock. Record both historical fork block and current simulation timestamp.

Transfer assertions cover maker, taker, router, Aqua physical balances, and both Aqua allocations. F1 requires successful transaction receipts/traces through this forked path, guard-specific revert evidence, and unchanged state on failure. Pure `eth_call`, mocked ERC-20s, or unrelated transfers cannot satisfy it. This accepted fork proof is not a claim of public-network deployment.

## D07: selected standardized Graph deployments

Primary [standardized schema guide](https://thegraph.com/docs/en/subgraphs/existing-subgraphs/standard-subgraphs/) and [Messari source pin](https://github.com/messari/subgraphs/tree/2711ac91ef119f321f65b339e10a57f9aa74f9d8) establish the shared schema family. The source `deployment/deployment.json` and `deployment/decentralized_network_deployments.csv` identify:

| Protocol | Subgraph query ID | Source version | Selected WETH/USDC pool |
| --- | --- | --- | --- |
| Uniswap v3 Ethereum | `4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6` | DEX-AMM Extended 4.0.0 | `0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640` (500 fee) |
| SushiSwap v3 Ethereum | `2tGWMrDha4164KkFAfkU3rDCtuxGb4q1emXmFdLLzJ8x` | DEX-AMM Extended 4.0.1 | `0x35644fb61afbc458bf92b15add6abc1996be5014` (500 fee) |

Both map to `subgraphs/uniswap-v3-forks/schema.graphql`; Sushi deployment is labeled dev in the registry, so do not represent it as a maintained production endpoint. The on-chain pools were checked with each factory's `getPool(WETH,USDC,500)`. Source provenance and common fields qualify the design for standardized-schema use; current indexing freshness is a live F2 assertion, not proven by the registry.

Endpoint pattern: `https://gateway.thegraph.com/api/<GRAPH_API_KEY>/subgraphs/id/<query-id>`. Never log the key-bearing URL. Query IDs identify subgraph entities, not immutable deployment CIDs: require `_meta.deployment` from live responses, record both CIDs and schema versions, and ensure they differ. Pin approved CIDs in each run manifest and reject mid-run changes. Same chain, different protocols, same query text; only pool variable and endpoint differ.

Current credential state: GRAPH_API_KEY absent. F2 live reads NOT RUN. Concrete acquisition: create a query API key in Graph Studio, authorize billing/quota as appropriate, inject through environment/secret storage, then run the preflight command in PROOFS. Do not use someone else's leaked demo key. If either selected source is stale/unavailable, F2 fails/blocks; selecting a replacement requires a recorded D07 amendment and repeating schema/identity checks. Static fixtures are explicitly synthetic examples, not claimed live responses.

## Privy capability sources

[Organization wallets](https://docs.privy.io/wallets/overview/solutions/organization-wallets), [owner/signer configuration](https://docs.privy.io/controls/authorization-keys/owners/configuration/programmable), [policies](https://docs.privy.io/controls/policies/overview), [Ethereum policy examples](https://docs.privy.io/controls/policies/example-policies/ethereum), and [sign transaction API](https://docs.privy.io/api-reference/wallets/ethereum/eth-sign-transaction) support the selected policy/signer request shape. Installed `@privy-io/node@0.34.0` declarations include chain_id, calldata ABI conditions, owner_id, and signer override_policy_ids. See OPERATIONS for the actual policy design.

Privy app credentials are absent. Live F3 is NOT RUN. Set up an app and organization-controlled authorization quorum, then inject credentials and role authorization keys; generating policies and expected request fixtures is possible without them. No claim of account-level policy acceptance is made until F3.
