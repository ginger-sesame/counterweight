# Pinned SwapVM base modification

Source: `@1inch/swap-vm` commit `f09a41e689240adc645934f965c8061749397cd2`, original `src/SwapVM.sol`. The full upstream license is preserved in `SwapVM-1.1.txt`; upstream copyright headers remain intact. Dependencies are installed from the exact root lockfile.

`SwapVM.patch` is the complete reviewable diff against that pinned source. Relative imports point into the unchanged upstream package. Both public entry points call mandatory `_validateEntry` before hash/parsing/execution. The swap path snapshots state before the VM and checks actual settlement before releasing the existing transient lock. Three abstract hooks require the concrete router to implement these checks. The original transfer functions, amount validation, order hashing and lock implementation are unchanged. The copied file is excluded from automatic formatting to preserve a minimal diff.

The only executable dispatcher is Counterweight's canonical guard/skew program. Entry validation compares the entire order to the constructor-bound hash and compares taker calldata with the canonical upstream builder encoding, rejecting alternate opcodes, hooks, callbacks, receivers, flags, order modes and trailing bytes.

The controller binds the predicted router CREATE address in its constructor, and the router checks this binding on construction. This avoids an operator-accessible registration setter and gives `resume()` a fixed Aqua allocation to inspect. Deploy the controller immediately before the router from the same deployer, using the next CREATE address; setup fails if that address prediction is wrong.
