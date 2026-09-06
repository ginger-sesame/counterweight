#!/usr/bin/env python3
"""Read-only fixed-block integration prerequisite checks. Never sends transactions."""
import json
import os
import urllib.request

BLOCK = 25917718
HASH = '0x5dcb9480fc701b19c587e6834118725afa28ef2ba1fca9fc9d14aa9a289c059e'
WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
URL = os.environ.get('ETHEREUM_RPC_URL', 'https://eth-mainnet.public.blastapi.io')


def rpc(method, params):
    assert method in {'eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call'}
    request = urllib.request.Request(URL, data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'counterweight-phase0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError(f'{method}: RPC error (inspect provider separately; credentials redacted)')
    return result['result']


def main():
    block = hex(BLOCK)
    header = rpc('eth_getBlockByNumber', [block, False])
    assert header and header['hash'] == HASH, 'Fork block mismatch'
    assert int(rpc('eth_chainId', []), 16) == 1
    result = {'result': 'PASS', 'scope': 'read-only prerequisites, not F1', 'blockNumber': BLOCK, 'blockHash': HASH, 'blockTimestamp': int(header['timestamp'], 16), 'chainId': 1, 'tokens': {}, 'pools': {}}
    for token, decimals in ((WETH, 18), (USDC, 6)):
        actual = int(rpc('eth_call', [{'to': token, 'data': '0x313ce567'}, block]), 16)
        assert actual == decimals
        assert rpc('eth_getCode', [token, block]) != '0x'
        result['tokens'][token] = {'decimals': actual, 'codePresent': True}
    for name, factory, expected in (
        ('uniswap-v3-500', '0x1f98431c8ad98523631ae4a59f267346ea31f984', '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'),
        ('sushiswap-v3-500', '0xbaceb8ec6b9355dfc0269c18bac9d6e2bdc29c4f', '0x35644fb61afbc458bf92b15add6abc1996be5014'),
    ):
        calldata = '0x1698ee82' + WETH[2:].zfill(64) + USDC[2:].zfill(64) + hex(500)[2:].zfill(64)
        pool = '0x' + rpc('eth_call', [{'to': factory, 'data': calldata}, block])[-40:]
        assert pool == expected
        result['pools'][name] = pool
    pool = result['pools']['uniswap-v3-500']
    balance = int(rpc('eth_call', [{'to': USDC, 'data': '0x70a08231' + pool[2:].zfill(64)}, block]), 16)
    assert balance >= 25_000 * 10**6
    result['forkFundingSource'] = {'address': pool, 'usdcBalance': str(balance)}
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
