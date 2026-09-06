# P-02 specification review

Reviewer: root agent. Date: 2026-09-06. Environment: Python 3.12.3, standard-library exact integer/Fraction arithmetic. Command: `python3 scripts/planning/validate_phase0.py`.

Authoring and checking use different formulations: whole-token rational bid/ask arithmetic produced fixed JSON values; validation checks the integer floor interval `out*denominator <= numerator < (out+1)*denominator`, post-state deltas, and exact rational exposure. This is a specification check, not an independently implemented production guard.

Manual anchors:

- At target, k=0 and maker bid is 2,000*(1-0.003)=1,994 USDC/WETH. Selling 0.1 WETH produces 199.4 USDC = 199400000 base units. Maker inventory becomes 10.1 WETH and 19,800.6 USDC.
- At target, maker ask is 2,006; 200 USDC buys floor(200/2006*10^18)=99700897308075772 WETH wei.
- 12 WETH plus 16,000 USDC gives 60% exposure; k=100 bps. Bid is 1,974.06 and ask is 1,985.94. This discourages selling more WETH to the maker and encourages buying its WETH.
- 8 WETH plus 24,000 USDC gives 40% exposure; k=-100. Bid is 2,013.94 and ask is 2,026.06. Incentives reverse.
- 9.9 WETH plus 20,200 USDC gives wBps=4950 and k=-5; a 0.2 WETH input returns 398.9994 USDC and crosses target without leaving bounds.
- Input 0.5 WETH equals the 1,000 USDC cap; one extra wei exceeds it even though output rounds to the same amount. Size guard must precede any rounding of input notional.
- Exactly 3 WETH and 14,000 USDC is 30%; exactly 7 WETH and 6,000 USDC is 70%. Adding/removing a single WETH wei distinguishes inside/outside without rounding exposure.
- 14.1 WETH/11,800 USDC can recover inside with a 500 USDC input; 15 WETH/10,000 USDC with 200 USDC improves but remains outside and is rejected.
- A one-wei WETH input returns zero and is rejected. One micro-USDC input returns 498504486 WETH wei, demonstrating asymmetric decimal handling.
- Negative skew smaller than one basis point truncates toward zero, covered separately from exact signed division.

Coverage: both directions; target/deficit/excess; crossing target; spread retained in price; maximum input and one-unit breach; both exact exposure limits and adjacent units; outside-bounds recovery and insufficient recovery; zero inventory; dust and single-rounding rules. All 16 quote and 9 boundary fixtures passed. Phase 1 still owes automated application tests S-01–S-08, including generated ranges and invalid configuration tests.
