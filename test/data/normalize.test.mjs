import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize, usdMicro} from '../../src/data/normalize.mjs';
const sources=JSON.parse(readFileSync(new URL('../../planning/phase0/fixtures/sources.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('../../planning/phase0/fixtures/graph-responses.json',import.meta.url))).responses;
function sample(index=0){
 const source=sources[index], envelope=structuredClone(fixtures[index]);
 const meta=envelope.response.data._meta, protocol=envelope.response.data.dexAmmProtocols[0], snapshot=envelope.response.data.liquidityPoolHourlySnapshots[0];
 meta.deployment=source.deploymentCid;meta.block.hash='0x'+'a'.repeat(64);
 protocol.schemaVersion=source.schemaVersion;snapshot.pool.id=source.pool;envelope.variables.pool=source.pool;
 envelope.fetchedAt=1788689100;
 return {envelope,source,context:{now:1788689100,head:{chainId:1,number:25917720,timestamp:1788689024},indexedBlock:{...meta.block}}};
}
const run=s=>normalize(s.envelope,s.source,s.context);
test('G-01 both source shapes normalize independently known values and token order',()=>{
 for(let i=0;i<2;i++){
  const s=sample(i), output=run(s);assert.equal(output.turnoverBps,(i+1)*1000);assert.equal(output.volumeUsdMicro,String((i+1)*10000000000));
  s.envelope.response.data.liquidityPoolHourlySnapshots[0].pool.inputTokens.reverse();assert.deepEqual(run(s),output);
 }
});
test('G-02 decimal wire arithmetic and magnitude boundaries',()=>{
 assert.equal(usdMicro('1445677.1372825911263796775529'),1445677137282n);
 assert.equal(usdMicro('0.0000009999999999999999999999999999'),0n);
 assert.equal(usdMicro('1000000000000000000.000000'),10n**24n);
 for(const v of [null,1,-1,'-1','NaN','Infinity','1e3',' 1','01','1.','0.'+'1'.repeat(35),'1000000000000000000.0000000000001'])assert.throws(()=>usdMicro(v));
});
test('G-01/G-02 rejects incomplete and mismatched responses',()=>{
 const mutations=[s=>s.envelope.response.errors=[],s=>s.envelope.response.data._meta.hasIndexingErrors=true,s=>s.envelope.response.data._meta.deployment='different',s=>s.envelope.response.data.dexAmmProtocols[0].schemaVersion='4.0.1',s=>s.envelope.response.data.dexAmmProtocols[0].network='ARBITRUM_ONE',s=>s.envelope.response.data.liquidityPoolHourlySnapshots=[],s=>s.envelope.response.data.liquidityPoolHourlySnapshots.push(s.envelope.response.data.liquidityPoolHourlySnapshots[0]),s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].pool.inputTokens[0].decimals=8,s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].totalValueLockedUSD='0.999999',s=>s.envelope.variables.hour--];
 for(const change of mutations){const s=sample();change(s);assert.throws(()=>run(s));}
});
test('G-03 exact source and fetch age, lag and RPC timestamp fallback',()=>{
 const s=sample();s.context.now=s.envelope.response.data._meta.block.timestamp+300;s.envelope.fetchedAt=s.context.now-120;assert.doesNotThrow(()=>run(s));
 s.context.now++;assert.throws(()=>run(s));
 const f=sample();f.envelope.fetchedAt=f.context.now-121;assert.throws(()=>run(f));
 const lag=sample();lag.context.head.number=lag.context.indexedBlock.number+25;assert.doesNotThrow(()=>run(lag));lag.context.head.number++;assert.throws(()=>run(lag));
 const absent=sample();delete absent.envelope.response.data._meta.block.timestamp;assert.equal(run(absent).indexedAt,absent.context.indexedBlock.timestamp);
 absent.context.indexedBlock.hash='0x'+'b'.repeat(64);assert.throws(()=>run(absent));
});
test('G-03 future timestamp, observed block, hour and RPC contradictions',()=>{
 const cases=[
  s=>s.context.head.timestamp=s.context.now+31,
  s=>s.context.head.chainId=31337,
  s=>s.context.head.number=s.context.indexedBlock.number-1,
  s=>s.context.indexedBlock.timestamp++,
  s=>s.envelope.fetchedAt=s.context.now+1,
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].timestamp=String(s.context.now+31),
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].timestamp=String(Math.floor(s.context.now/3600)*3600-3601),
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].blockNumber=String(s.context.indexedBlock.number+1),
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].hour++,
 ];
 for(const mutate of cases){const s=sample();mutate(s);assert.throws(()=>run(s));}
 const boundary=sample();const m=boundary.envelope.response.data._meta;
 m.block.timestamp=boundary.context.now+30;boundary.context.indexedBlock.timestamp=m.block.timestamp;boundary.context.head.timestamp=m.block.timestamp;
 assert.doesNotThrow(()=>run(boundary));m.block.timestamp++;boundary.context.indexedBlock.timestamp++;boundary.context.head.timestamp++;assert.throws(()=>run(boundary));
});
test('G-02 token duplication, missing types, decimal cap and turnover saturation',()=>{
 for(const mutate of [
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].pool.inputTokens[1]=s.envelope.response.data.liquidityPoolHourlySnapshots[0].pool.inputTokens[0],
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].timestamp=123,
  s=>s.envelope.response.data.liquidityPoolHourlySnapshots[0].hourlyVolumeUSD=null,
  s=>s.envelope.response.data.dexAmmProtocols[0].methodologyVersion='2.0.0',
  s=>s.envelope.response.data._meta.block.number=Number.MAX_SAFE_INTEGER+1,
 ]){const s=sample();mutate(s);assert.throws(()=>run(s));}
 const s=sample();s.envelope.response.data.liquidityPoolHourlySnapshots[0].hourlyVolumeUSD='1000000000000000000';assert.equal(run(s).turnoverBps,10000);
});
