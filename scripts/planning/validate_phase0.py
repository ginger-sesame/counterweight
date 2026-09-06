#!/usr/bin/env python3
"""Offline specification checks only. Does not implement or certify the strategy."""
import json
from pathlib import Path
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'planning' / 'phase0'


def check_accounting():
    spec = json.loads((BASE / 'fixtures/accounting.json').read_text())
    price, scale, bps = int(spec['referencePriceMicroUsdc']), 10**18, 10_000
    for case in spec['quotes']:
        w, u, amount = (int(case[k]) for k in ('wethWei', 'usdcUnits', 'amountIn'))
        weight = bps * w * price // (w * price + u * scale)
        signed = (weight - 5000) * spec['intensityBps']
        skew = (1 if signed >= 0 else -1) * (abs(signed) // bps)
        skew = max(-200, min(200, skew))
        assert (weight, skew) == (case['expectedWeightBps'], case['expectedSkewBps']), case['id']
        out = int(case['expectedOut'])
        if case['tokenIn'] == 'WETH':
            numerator = amount * price * (bps-skew) * (bps-spec['spreadBps'])
            denominator = scale * bps**2
            post_w, post_u = w+amount, u-out
            size_ok = amount * price <= 1_000_000_000 * scale
        else:
            numerator = amount * scale * bps**2
            denominator = price * (bps-skew) * (bps+spec['spreadBps'])
            post_w, post_u = w-out, u+amount
            size_ok = amount <= 1_000_000_000
        # Verify the defining interval of floor, not a duplicate output calculation.
        assert out * denominator <= numerator < (out+1)*denominator, case['id']
        assert (post_w, post_u) == (int(case['expectedPostWethWei']), int(case['expectedPostUsdcUnits'])), case['id']
        exposure = Fraction(post_w*price, post_w*price+post_u*scale)
        result = ('TradeTooLarge' if not size_ok else 'ZeroOutput' if out == 0 else
                  'PASS' if Fraction(3,10) <= exposure <= Fraction(7,10) else 'ExposureOutOfBounds')
        assert result == case['expectedResult'], case['id']
    for case in spec['guardBoundaries']:
        a, b = int(case['postWethWei'])*price, int(case['postUsdcUnits'])*scale
        valid = a+b > 0 and 3000*(a+b) <= bps*a <= 7000*(a+b)
        assert valid == case['expectedPass'], case['id']
    by_id = {case['id']: case for case in spec['quotes']}
    assert int(by_id['excess-buy']['expectedOut']) > int(by_id['target-buy']['expectedOut']) > int(by_id['deficit-buy']['expectedOut'])
    assert int(by_id['deficit-sell']['expectedOut']) > int(by_id['target-sell']['expectedOut']) > int(by_id['excess-sell']['expectedOut'])
    print(f"P-02 arithmetic: PASS ({len(spec['quotes'])} quote fixtures, {len(spec['guardBoundaries'])} exact boundary fixtures)")


if __name__ == '__main__':
    check_accounting()
