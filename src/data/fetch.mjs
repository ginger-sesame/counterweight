import { setTimeout as sleep } from 'node:timers/promises';
import { requireThat } from './normalize.mjs';
// Never propagate transport exception messages: they can contain URLs/headers with credentials.
export class DataUnavailable extends Error {}
export async function requestJson(url, payload, { fetchImpl = fetch, sleepImpl = sleep, timeoutMs = 10000, attempts = 3, signal } = {}) {
  requireThat(Number.isInteger(attempts) && attempts >= 1 && attempts <= 3 && timeoutMs > 0 && timeoutMs <= 10000, 'request bounds');
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw new DataUnavailable('cycle deadline');
    let retry = false;
    try {
      const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Counterweight/0.1' }, body: JSON.stringify(payload), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
      if (response.status === 429 || response.status >= 500) retry = true;
      else {
        requireThat(response.ok, `provider HTTP ${response.status}`);
        const body = await response.text();
        requireThat(body.length <= 1000000, 'response size');
        try { return JSON.parse(body); } catch { throw new Error('provider JSON'); }
      }
    } catch (error) {
      if (/^(provider HTTP|provider JSON|response size)/.test(error.message)) throw error;
      retry = true;
    }
    if (retry && attempt + 1 < attempts) await sleepImpl(1000 * (attempt + 1));
  }
  throw new DataUnavailable('provider unavailable after bounded retries');
}
export async function collectPair({ sources, query, apiKey, rpcUrl = 'https://eth-mainnet.public.blastapi.io', now = () => Math.floor(Date.now() / 1000), request = requestJson }) {
  if (typeof apiKey !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(apiKey)) throw new DataUnavailable('GRAPH_API_KEY required');
  const signal = AbortSignal.timeout(35000);
  const start = now(), hour = Math.floor(start / 3600) - 1;
  const rpc = async (method, params = []) => {
    const response = await request(rpcUrl, { jsonrpc: '2.0', id: 1, method, params }, { signal });
    requireThat(response && !response.error && response.result != null, 'RPC response');
    return response.result;
  };
  const block = value => {
    requireThat(value && /^0x[0-9a-f]+$/i.test(value.number) && /^0x[0-9a-f]+$/i.test(value.timestamp), 'RPC block format');
    return { number: Number(BigInt(value.number)), timestamp: Number(BigInt(value.timestamp)), hash: value.hash };
  };
  const outcomes = await Promise.allSettled(sources.map(async source => {
    const variables = { pool: source.pool, hour };
    const response = await request(`https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${source.subgraphId}`, { query, variables }, { signal });
    return { sourceKey: source.key, variables, fetchedAt: now(), response };
  }));
  const failures = outcomes.flatMap((r, i) => r.status === 'rejected' ? [{ sourceKey: sources[i].key, reason: 'source request failed' }] : []);
  const envelopes = outcomes.map(r => r.status === 'fulfilled' ? r.value : null);
  if (failures.length) return { result: 'UNAVAILABLE', envelopes, failures, startedAt: start, finishedAt: now() };
  const [chainId, rawHead] = await Promise.all([rpc('eth_chainId'), rpc('eth_getBlockByNumber', ['latest', false])]);
  requireThat(chainId === '0x1', 'Ethereum RPC chain');
  const blocks = {};
  await Promise.all([...new Set(envelopes.map(e => e.response?.data?._meta?.block?.number))].map(async number => {
    requireThat(Number.isSafeInteger(number) && number >= 0, 'Graph block number');
    blocks[number] = block(await rpc('eth_getBlockByNumber', ['0x' + number.toString(16), false]));
  }));
  return { result: 'COLLECTED', envelopes, context: { now: now(), head: { ...block(rawHead), chainId: 1 }, blocks }, startedAt: start, finishedAt: now() };
}
