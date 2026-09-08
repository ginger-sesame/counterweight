// D08 wire validation. USD arithmetic stays in integer micro-dollars.
export const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
export const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export function requireThat(condition, reason) {
  if (!condition) throw new Error(reason);
}
export function integer(value, name) {
  requireThat(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, name);
  return value;
}
function wireInteger(value, name) {
  requireThat(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 16, name);
  return integer(Number(value), name);
}
export function usdMicro(value) {
  requireThat(typeof value === 'string' && value.length <= 64 && /^(0|[1-9][0-9]*)(\.[0-9]{1,34})?$/.test(value), 'USD decimal format');
  const [whole, fraction = ''] = value.split('.');
  requireThat(BigInt(whole) <= 10n ** 18n && (BigInt(whole) < 10n ** 18n || !/[1-9]/.test(fraction)), 'USD magnitude');
  return BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6));
}
function text(value, name) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= 256, name);
  return value;
}
export function snapshotId(pool, hour) {
  requireThat(/^0x[0-9a-f]{40}$/.test(pool) && Number.isInteger(hour) && hour >= 0 && hour <= 2147483647, 'snapshot identity inputs');
  const bytes = Buffer.alloc(4); bytes.writeInt32LE(hour); return pool + bytes.toString('hex');
}
export function normalize(envelope, source, context) {
  const { now, head, indexedBlock } = context;
  integer(now, 'now'); integer(head.number, 'head number'); integer(head.timestamp, 'head timestamp');
  requireThat(head.chainId === 1 && head.timestamp <= now + 30 && now - head.timestamp <= 300, 'RPC head identity/freshness');
  const { response, fetchedAt, variables } = envelope;
  integer(fetchedAt, 'fetch time');
  requireThat(fetchedAt <= now && now - fetchedAt <= 120, 'fetch freshness');
  requireThat(response && !response.errors && response.data, 'GraphQL response');
  const { _meta: meta, dexAmmProtocols: protocols, liquidityPoolHourlySnapshot: snapshot } = response.data;
  requireThat(meta && meta.hasIndexingErrors === false && meta.deployment === source.deploymentCid, 'deployment/indexing identity');
  requireThat(Array.isArray(protocols) && protocols.length === 1, 'protocol count');
  const protocol = protocols[0];
  requireThat(protocol.network === 'MAINNET' && protocol.schemaVersion === source.schemaVersion && protocol.methodologyVersion === source.methodologyVersion, 'protocol identity');
  text(protocol.id, 'protocol id'); text(protocol.subgraphVersion, 'subgraph version');
  const block = meta.block;
  requireThat(block && /^0x[0-9a-fA-F]{64}$/.test(block.hash), 'indexed block hash');
  const number = integer(block.number, 'indexed block number');
  requireThat(indexedBlock && indexedBlock.number === number && indexedBlock.hash?.toLowerCase() === block.hash.toLowerCase(), 'RPC indexed block identity');
  const indexedAt = block.timestamp == null ? integer(indexedBlock.timestamp, 'RPC indexed time') : integer(block.timestamp, 'indexed time');
  requireThat(indexedAt === indexedBlock.timestamp && indexedAt <= head.timestamp && number <= head.number && head.number - number <= 25, 'indexing lag/consistency');
  requireThat(indexedAt <= now + 30 && now - indexedAt <= 300, 'indexing freshness');
  const hourEnd = Math.floor(now / 3600) * 3600, hourStart = hourEnd - 3600;
  requireThat(variables?.pool === source.pool && variables.hour === hourStart / 3600 && variables.snapshot === snapshotId(source.pool, variables.hour), 'query variables');
  requireThat(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'completed-hour snapshot');
  requireThat(snapshot.id === variables.snapshot, 'snapshot primary key');
  requireThat(snapshot.hour === variables.hour, 'snapshot hour'); text(snapshot.id, 'snapshot id');
  const observedAt = wireInteger(snapshot.timestamp, 'snapshot time'), observedBlock = wireInteger(snapshot.blockNumber, 'snapshot block');
  requireThat(observedAt >= hourStart && observedAt <= indexedAt + 30 && observedAt <= now + 30 && now - observedAt <= 7200 && observedBlock <= number, 'snapshot freshness/consistency');
  requireThat(source.chainId === 1 && snapshot.pool?.id === source.pool, 'pool/chain');
  requireThat(context.tokenIdentityBlock === head.number, 'token identity block');
  const tokens = context.poolTokens?.[source.pool];
  requireThat(Array.isArray(tokens) && tokens.length === 2 && tokens.filter(t => t.id === WETH && t.decimals === 18).length === 1 && tokens.filter(t => t.id === USDC && t.decimals === 6).length === 1, 'token identity/decimals');
  const volume = usdMicro(snapshot.hourlyVolumeUSD), tvl = usdMicro(snapshot.totalValueLockedUSD);
  requireThat(tvl >= 1000000n, 'TVL minimum');
  const turnover = volume * 10000n / tvl;
  return Object.freeze({ schemaVersion: 'counterweight.regime.v1', sourceKey: source.key, subgraphId: source.subgraphId, deploymentCid: source.deploymentCid, sourceSchemaVersion: protocol.schemaVersion, methodologyVersion: protocol.methodologyVersion, chainId: 1, pool: source.pool, weth: { id: WETH, decimals: 18 }, usdc: { id: USDC, decimals: 6 }, indexedBlock: number, indexedAt, fetchedAt, hourStart, hourEnd, observedAt, volumeUsdMicro: String(volume), tvlUsdMicro: String(tvl), turnoverBps: Number(turnover > 10000n ? 10000n : turnover) });
}
