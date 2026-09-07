#!/usr/bin/env python3
"""Verify pinned original source, exact reviewable base diff, and unchanged upstream license."""
from pathlib import Path
import difflib
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
original = ROOT / 'node_modules/@1inch/swap-vm/src/SwapVM.sol'
assert hashlib.sha256(original.read_bytes()).hexdigest() == 'cc1570a009d967497290ce604c0f3942cd84416c3d2b996cab6e965eef1fe9bf'
modified = ROOT / 'contracts/upstream/SwapVM.sol'
diff = ''.join(difflib.unified_diff(original.read_text().splitlines(True), modified.read_text().splitlines(True), fromfile='a/src/SwapVM.sol', tofile='b/src/SwapVM.sol'))
assert diff == (ROOT / 'contracts/upstream/SwapVM.patch').read_text(), 'Upstream modification differs from reviewed patch'
assert (ROOT / 'contracts/upstream/SwapVM-1.1.txt').read_bytes() == (ROOT / 'node_modules/@1inch/swap-vm/LICENSES/SwapVM-1.1.txt').read_bytes()
lock = json.loads((ROOT / 'package-lock.json').read_text())['packages']
for package, commit in [('@1inch/swap-vm', 'f09a41e689240adc645934f965c8061749397cd2'), ('@1inch/aqua', '098b4c5d8eec67677f7ca861ca991af56024d9c5')]:
    assert lock['node_modules/' + package]['resolved'].endswith('#' + commit), package
for package, version in [('@1inch/solidity-utils', '6.9.10'), ('@openzeppelin/contracts', '5.4.0')]:
    assert lock['node_modules/' + package]['version'] == version, package
print('PASS: pinned upstream source/dependencies, exact hook patch and preserved license')
