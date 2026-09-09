#!/usr/bin/env python3
"""Independently verify demo presentation arithmetic, provenance and portable links."""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('bundle', type=Path)
p.add_argument('--out', required=True, type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
bundle = a.bundle.resolve()
load = lambda name: json.loads((bundle / name).read_text())
s, m, proof = load('summary.json'), load('demo-manifest.json'), load('proof/manifest.json')
assert m['result'] == 'PASS' and s['mode'] == m['mode']
assert s['runId'] == m['runId'] == proof['runId']
assert s['gitRevision'] == m['proofRevision'] == proof['gitRevision']
assert s['runAt'] == m['originalRunAt'] == proof['runAt']
assert s['assertions'] == proof['assertions'] == 97
assert s['referencePriceUsd'] == '2000'
assert (s['minPercent'], s['targetPercent'], s['maxPercent']) == (30, 50, 70)
assert s['maker'] == proof['maker'] and s['controller'] == proof['epochs'][0]['controller']
assert s['orderHash'] == proof['epochs'][0]['orderHash']
for path, expected in m['artifactHashes'].items():
    target = (bundle / path).resolve()
    assert target.is_relative_to(bundle) and not (bundle / path).is_symlink()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == expected
for path, expected in m['reporterSourceHashes'].items():
    source = subprocess.check_output(['git', 'show', m['reporterRevision'] + ':' + path], cwd=root)
    assert hashlib.sha256(source).hexdigest() == expected
report = (bundle / 'report.md').read_text()
assert ('FRESH LIVE RUN' if s['mode'] == 'live' else 'RECORDED REPLAY') in report
links = re.findall(r'\]\(([^)]+)\)', report)
for target in links:
    assert '://' not in target and not Path(target).is_absolute()
    path = (bundle / target).resolve()
    assert path.is_relative_to(bundle) and path.is_file()

def units(raw, decimals):
    integer, fraction = divmod(int(raw), 10 ** decimals)
    fraction = str(fraction).zfill(decimals).rstrip('0')
    return str(integer) + ('.' + fraction if fraction else '')

def check_inventory(view, raw):
    w, u = map(int, raw)
    numerator, denominator = w * 2_000_000_000, w * 2_000_000_000 + u * 10 ** 18
    percent = numerator * 1_000_000 // denominator
    assert view == dict(wethWei=raw[0], usdcUnits=raw[1], weth=units(w, 18), usdc=units(u, 6),
                        wethPercent=f'{percent // 10000}.{percent % 10000:04d}',
                        exposureNumerator=str(numerator), exposureDenominator=str(denominator))

scenarios = load('proof/scenarios.json')
assert len(s['attempts']) == len(scenarios) == 8
for step, (view, raw) in enumerate(zip(s['attempts'], scenarios), 1):
    assert view['step'] == step and view['transactionHash'] == raw['transaction']
    assert view['reason'] == raw.get('error')
    assert view['outcome'] == ('REJECTED' if raw.get('error') else 'FILLED')
    token, decimals = ('WETH', 18) if raw['wethIn'] else ('USDC', 6)
    other, other_decimals = ('USDC', 6) if raw['wethIn'] else ('WETH', 18)
    assert view['input'] == units(raw['amountIn'], decimals) + ' ' + token
    assert view['output'] == (None if raw.get('error') else units(raw['amountOut'], other_decimals) + ' ' + other)
    for side in ['before', 'after']:
        check_inventory(view[side], raw[side]['allocations'])
    outcome = view['outcome'] + (' — ' + view['reason'] if view['reason'] else '')
    row = f"| {step}. {view['title']} | {outcome} | {view['input']} | {view['output'] or 'None (reverted)'} | {view['before']['wethPercent']}% → {view['after']['wethPercent']}% |"
    assert row in report
assert s['start'] == s['attempts'][0]['before'] and s['finish'] == s['attempts'][-1]['after']
iso = lambda seconds: datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
live = [x for x in load('proof/graph.json') if not x.get('injected')]
assert len(live) == len(s['updates']) == 3
for view, raw in zip(s['updates'], live):
    assert view['transactionHash'] == raw['transactionHash']
    for key in ['intensityBps', 'spreadBps']:
        assert view[key] == raw['evaluated']['tuning'][key]
    assert len(view['sources']) == 2
    for source, observation in zip(view['sources'], raw['evaluated']['observations']):
        assert source['deploymentCid'] == observation['deploymentCid'] and source['pool'] == observation['pool']
        assert source['venue'] == {'uniswap-v3-ethereum': 'Uniswap V3', 'sushiswap-v3-ethereum': 'SushiSwap V3'}[observation['sourceKey']]
        for key in ['windowStart', 'windowEnd', 'fetchedAt']:
            assert source[key] == iso(observation[key])
        assert source['dailyVolumeUsd'] == units(observation['volumeUsdMicro'], 6)
        assert source['tvlUsd'] == units(observation['tvlUsdMicro'], 6)
    assert f"| {view['stage']} | {view['intensityBps']} | {view['spreadBps']} | {view['sources'][0]['windowStart']} → {view['sources'][0]['windowEnd']} |" in report
for view, raw in zip(s['permissions'], load('proof/operations.json')):
    assert view['correlationId'] == raw['failure']['correlationId']
    assert view['correlationId'] in report and view['boundary'] in report
restart = load('proof/restart.json')
assert s['restart']['status'] == restart['result']['status'] == 'CONFIRMED'
assert s['restart']['action'] == restart['result']['action'] == 'DO_NOT_REPEAT'
assert s['restart']['transactionHash'] == restart['result']['transactionHash']
assert s['restart']['nonceUnchanged'] and restart['nonceBefore'] == restart['nonceAfter']
assert s['restart']['signatureCountUnchanged'] and restart['signatureCountBefore'] == restart['signatureCountAfter']
assert load('proof-audit.json')['result'] == 'PASS'
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(dict(result='PASS', runId=s['runId'], reporterRevision=m['reporterRevision'], proofRevision=m['proofRevision'],
    attempts=8, livePairs=3, portableLinks=len(links), artifactHashes=len(m['artifactHashes']),
    checks=['exact token formatting and exposure fractions', 'Markdown trade and tuning rows', 'Graph source identity and times',
            'permission correlations and restart identity', 'copied evidence hashes', 'reporter source hashes at recorded revision']), indent=2) + '\n')
print('PASS: exact presentation arithmetic, identities, links and source/artifact hashes')
