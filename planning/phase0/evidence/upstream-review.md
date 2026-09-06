# P-03 upstream baseline experiment

Date: 2026-09-06. Reviewer: root agent. Isolated checkout: `/tmp/counterweight-research/swap-vm` (disposable; do not depend on this path for reproduction).

- SwapVM commit: f09a41e689240adc645934f965c8061749397cd2.
- Aqua npm Git dependency: v1.0.0, 098b4c5d8eec67677f7ca861ca991af56024d9c5. Inspected that tag's source, not just Aqua main.
- Node 22.22.1, npm 10.9.4; upstream npm install with scripts disabled. Upstream transitive Hardhat peer/deprecation warnings did not prevent this Forge compilation.
- Foundry 1.8.1 build 982849d3140c01fd3b72905759581a132df7aa98; downloaded archive checksum matched release checksum.
- Command: `forge test --match-path test/SwapVmAccounting.t.sol -vv`.
- Compiler: solc 0.8.30, viaIR, optimizer 700. 143 source files compiled; only unused-local-variable warnings in the upstream test.
- Result: **16 passed, 0 failed, 0 skipped**. Coverage includes XYC, concentrated XYC, decay, protocol fees and flat-fee accounting under exact-in/exact-out upstream modes.

This experiment proves the selected upstream toolchain can compile and execute its accounting tests. Those tests use upstream fixtures; they do not prove Counterweight's custom skew/guard, real forked WETH/USDC settlement, or F1. Counterweight deliberately excludes extra protocol fees and exact-output in its initial supported interface.

Reproduction uses the pinned checkout and setup procedure in PROOFS.md. The Phase 1 application dependency lock must be committed before implementing the custom contracts. Source review also identified the non-virtual external entry points, pre-settlement runLoop, strategy-scoped Aqua allocations, and two-byte instruction format; those findings determine the planned minimal upstream diff in INTEGRATIONS.md.
