#!/usr/bin/env python3
"""Offline specification checks only. Does not implement or certify the strategy."""
import json
import re
import copy
from decimal import Decimal
from pathlib import Path
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'planning' / 'phase0'


def check_accounting():
    spec = json.loads((BASE / 'fixtures/accounting.json').read_text())
    assert len(spec['quotes']) == 16 and len({r['id'] for r in spec['quotes']}) == 16
    assert len(spec['guardBoundaries']) == 9
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


def check_data():
    fixture = json.loads((BASE / 'fixtures/graph-responses.json').read_text())
    sources = json.loads((BASE / 'fixtures/sources.json').read_text())
    assert fixture['synthetic'] is True
    assert len(sources) == len(fixture['responses']) == 2
    assert len({s['subgraphId'] for s in sources}) == 2
    turnovers = []
    for source, sample in zip(sources, fixture['responses']):
        assert sample['sourceKey'] == source['key'] and sample['synthetic']
        data = sample['response']['data']
        assert data['dexAmmProtocols'][0]['schemaVersion'] == source['schemaVersion']
        snapshot, = data['liquidityPoolHourlySnapshots']
        assert snapshot['pool']['id'] == sample['variables']['pool'] == source['pool']
        assert snapshot['hour'] == sample['variables']['hour']
        tokens = {t['id']: t['decimals'] for t in snapshot['pool']['inputTokens']}
        assert tokens == {'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2':18, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48':6}
        volume = int(Decimal(snapshot['hourlyVolumeUSD'])*10**6)
        tvl = int(Decimal(snapshot['totalValueLockedUSD'])*10**6)
        r = min(10000, 10000*volume//tvl)
        assert r == sample['expectedTurnoverBps']
        turnovers.append(r)
    r = max(turnovers)
    assert 10+90*r//10000 == fixture['expectedSpreadBps']
    assert 1000-500*r//10000 == fixture['expectedIntensityBps']
    for r, expected in [(0,(10,1000)), (2000,(28,900)), (10000,(100,500))]:
        assert (10+90*r//10000, 1000-500*r//10000) == expected
    # Exhaustive finite-domain review of the specified mapper's envelope.
    for r in range(10001):
        assert 10 <= 10+90*r//10000 <= 100
        assert 500 <= 1000-500*r//10000 <= 1000
    print('P-04 data tabletop: PASS (2 synthetic source fixtures, endpoints and 10,001 mapping inputs)')


def evaluate_rule(policy, request):
    # Tabletop semantics only: these records contain already-decoded fields.
    # Actual Privy calldata parsing, identity authorization and policy enforcement remain F3.
    def matches(c):
        if c['field'] not in request:
            return False
        actual, wanted = request[c['field']], c['value']
        if c['operator'] == 'eq':
            return actual == wanted
        if c['operator'] == 'gte':
            return int(actual) >= int(wanted)
        if c['operator'] == 'lte':
            return int(actual) <= int(wanted)
        raise AssertionError('Unsupported tabletop operator')
    actions = [rule['action'] for rule in policy['rules'] if rule['method'] == request['method'] and all(matches(c) for c in rule['conditions'])]
    return 'ALLOW' in actions and 'DENY' not in actions


def check_policy():
    policy = json.loads((BASE / 'fixtures/updater-policy.json').read_text())
    cases = json.loads((BASE / 'fixtures/policy-cases.json').read_text())['cases']
    assert len(cases) == 17
    assert policy['owner_id'] == '${OWNER_QUORUM_ID}'
    assert len(policy['rules']) == 1
    for case in cases:
        assert evaluate_rule(policy, case['request']) == case['expectedAllow'], case['id']
    # Demonstrate the cases catch an omitted destination restriction.
    altered = copy.deepcopy(policy)
    altered['rules'][0]['conditions'] = [c for c in altered['rules'][0]['conditions'] if c['field'] != 'to']
    wrong = next(c for c in cases if c['id'] == 'wrong-destination')
    assert evaluate_rule(altered, wrong['request']) is True
    emergency = json.loads((BASE / 'fixtures/emergency-policy.json').read_text())
    valid = {**cases[0]['request'], 'function_name':'pause'}
    assert evaluate_rule(emergency, valid)
    assert not evaluate_rule(emergency, {**valid, 'function_name':'resume'})
    owner = json.loads((BASE / 'fixtures/owner-policy.json').read_text())
    assert not evaluate_rule(owner, {**valid, 'method':'exportPrivateKey'})
    wallet = json.loads((BASE / 'fixtures/wallet-create.json').read_text())
    assert wallet['owner_id'] == '${OWNER_QUORUM_ID}'
    assert len(wallet['additional_signers']) == 2
    assert len({s['signer_id'] for s in wallet['additional_signers']}) == 2
    assert all(len(s['override_policy_ids']) == 1 for s in wallet['additional_signers'])
    quorum = json.loads((BASE / 'fixtures/owner-quorum-create.json').read_text())
    assert quorum['authorization_threshold'] == 2 and len(set(quorum['public_keys'])) == 3
    print('P-04 authority tabletop: PASS (17 updater cases, destination mutation, emergency/owner restrictions and ownership shape)')


def check_package():
    expected = {f'{group}-{i:02d}' for group,n in [('P',4),('S',8),('V',7),('G',7),('O',7),('E',5)] for i in range(1,n+1)}
    ledger = (BASE / 'TRACEABILITY.md').read_text()
    actual = set(re.findall(r'^\| ([PSVGOE]-\d{2}) \|', ledger, re.M))
    assert actual == expected, (expected-actual, actual-expected)
    assert all(f'| D{i:02d} |' in ledger for i in range(1,15))
    for file in list(BASE.glob('*.md')) + [ROOT/'planning/README.md']:
        for target in re.findall(r'\]\(([^)]+)\)', file.read_text()):
            if '://' not in target and not target.startswith('#'):
                assert (file.parent / target.split('#')[0]).exists(), (file,target)
    assert all((BASE/name).exists() for name in ['ACCOUNTING.md','INTEGRATIONS.md','DATA.md','OPERATIONS.md','PROOFS.md','evidence/readiness.md'])
    print('P-01 package integrity: PASS (14 decision mappings, 38 test mappings and document links; readiness also requires recorded review)')


if __name__ == '__main__':
    check_accounting()
    check_data()
    check_policy()
    check_package()
