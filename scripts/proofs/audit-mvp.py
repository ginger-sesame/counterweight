#!/usr/bin/env python3
"""Independent retained-evidence audit. Does not create a live gate result."""
import argparse
import hashlib
import json
import subprocess
from decimal import Decimal, localcontext
from fractions import Fraction
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('proof', type=Path)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
load = lambda name: json.loads((args.proof / name).read_text())
m = load('manifest.json')
assert m['gate'] == 'F4' and m['result'] == 'PASS'
assert m['testIds'] == ['E-01', 'E-02', 'E-03'] and len(m['epochs']) == 1
assert m['runId'] and m['gitRevision'] and m['chainId'] == 31337
assert all(x['result'] == 'PASS' for x in load('assertions.json'))
assert m['assertions'] == len(load('assertions.json'))
source_hashes = m['sourceHashes'] | m['integrationSourceHashes']
for path, digest in source_hashes.items():
    content = subprocess.check_output(['git', 'show', f"{m['gitRevision']}:{path}"])
    assert hashlib.sha256(content).hexdigest() == digest, f'source revision mismatch: {path}'

pairs = [x for x in load('graph.json') if not x.get('injected')]
assert len(pairs) == 3
with localcontext() as ctx:
    ctx.prec = 100
    for pair in pairs:
        assert pair['collection']['result'] == 'COLLECTED'
        observations = pair['evaluated']['observations']
        assert len(observations) == 2 and len({x['deploymentCid'] for x in observations}) == 2
        expected_turnovers = []
        for envelope, observation in zip(pair['collection']['envelopes'], observations):
            raw = envelope['response']['data']['liquidityPoolDailySnapshot']
            volume = int(Decimal(raw['dailyVolumeUSD']) * 10**6)
            tvl = int(Decimal(raw['totalValueLockedUSD']) * 10**6)
            turnover = min(10000, volume * 10000 // (24 * tvl))
            assert int(observation['volumeUsdMicro']) == volume
            assert int(observation['tvlUsdMicro']) == tvl
            assert observation['turnoverBps'] == turnover
            assert observation['windowSeconds'] == 86400
            expected_turnovers.append(turnover)
        regime = max(expected_turnovers)
        assert pair['evaluated']['tuning'] == {'intensityBps': 1000-500*regime//10000, 'spreadBps': 10+90*regime//10000}

scenarios = load('scenarios.json')
assert len(scenarios) == m['scenarios'] == 7
assert len({x['branch'] for x in scenarios}) == 1
assert scenarios[0]['before']['allocations'] == ['14000000000000000000', '12000000000']
assert scenarios[0]['amountIn'] == '200000000' and not scenarios[0]['wethIn']
assert scenarios[1]['amountIn'] == '500000000000000000' and scenarios[1]['wethIn']
assert [x['error'] for x in scenarios if 'error' in x] == ['ExposureOutOfBounds', 'ExposureOutOfBounds', 'SafeTransferFromFailed', 'Paused']
for previous, current in zip(scenarios, scenarios[1:]):
    assert previous['after']['allocations'] == current['before']['allocations'], 'discontinuous inventory'
for scenario in scenarios:
    before, after = scenario['before'], scenario['after']
    assert before['safetyDigest'] == after['safetyDigest'] == load('checkpoint.json')['safetyDigest']
    if 'error' in scenario:
        assert before == after
        if scenario['error'] == 'SafeTransferFromFailed':
            assert scenario['settlementTrace']['error']
        continue
    w, u = map(int, before['allocations'])
    amount, out = int(scenario['amountIn']), int(scenario['amountOut'])
    tuning = scenario['effectiveTuning']
    weight = w*2_000_000_000*10000//(w*2_000_000_000+u*10**18)
    signed = (weight-5000)*int(tuning['intensityBps'])
    skew = max(-200, min(200, (1 if signed >= 0 else -1)*(abs(signed)//10000)))
    spread = int(tuning['spreadBps'])
    if scenario['wethIn']:
        numerator, denominator = amount*2_000_000_000*(10000-skew)*(10000-spread), 10**18*10000**2
        i, o = 0, 1
    else:
        numerator, denominator = amount*10**18*10000**2, 2_000_000_000*(10000-skew)*(10000+spread)
        i, o = 1, 0
    # Verify the defining floor interval, independently of the runner's calculation.
    assert out*denominator <= numerator < (out+1)*denominator
    for balances in [('allocations', None), ('physical', 'maker')]:
        b = before[balances[0]] if balances[1] is None else before[balances[0]][balances[1]]
        a = after[balances[0]] if balances[1] is None else after[balances[0]][balances[1]]
        assert int(a[i])-int(b[i]) == amount and int(b[o])-int(a[o]) == out
    assert int(before['physical']['taker'][i])-int(after['physical']['taker'][i]) == amount
    assert int(after['physical']['taker'][o])-int(before['physical']['taker'][o]) == out
    for holder in ['router', 'aqua']:
        assert before['physical'][holder] == after['physical'][holder]
    post_w, post_u = map(int, after['allocations'])
    assert Fraction(3, 10) <= Fraction(post_w*2_000_000_000, post_w*2_000_000_000+post_u*10**18) <= Fraction(7, 10)
transactions = load('transactions.json')
assert all(int(b['blockNumber']) > int(a['blockNumber']) for a, b in zip(transactions, transactions[1:]))
hashes = {x['hash'] for x in transactions}
assert all(x['transactionHash'] in hashes for x in pairs)
assert all(x['transaction'] in hashes for x in scenarios)
restart = load('restart.json')
assert restart['result']['status'] == 'CONFIRMED' and restart['result']['action'] == 'DO_NOT_REPEAT'
assert restart['result']['transactionHash'] in hashes
assert restart['nonceBefore'] == restart['nonceAfter'] and restart['signatureCountBefore'] == restart['signatureCountAfter']
assert restart['runId'] == m['runId'] == load('checkpoint.json')['runId']
operations = load('operations.json')
assert len(operations) == 2 and operations[0]['failure']['code'] == 'policy_violation'
assert operations[1]['kind'] == 'authorization'
assert all(x['before'] == x['after'] and x['failure']['correlationId'] for x in operations)
files = ['manifest.json'] + m['artifacts']
assert len(files) == len(set(files))
report = {'result': 'PASS', 'gitRevision': m['gitRevision'], 'runId': m['runId'], 'sourceFilesVerified': len(source_hashes), 'livePairsIndependentlyRecomputed': len(pairs), 'continuousSettlementScenarios': len(scenarios), 'artifactHashes': {name: hashlib.sha256((args.proof/name).read_bytes()).hexdigest() for name in files}, 'limitations': ['This audit checks retained public evidence; live runtime assertions and a separate credential-aware secret scan remain required.']}
args.out.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['artifactHashes', 'limitations']}))
