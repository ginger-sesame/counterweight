import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluatePair} from '../../src/data/regime.mjs';
import {collectPair} from '../../src/data/fetch.mjs';
const sources=JSON.parse(readFileSync(new URL('../../planning/phase0/fixtures/sources.json',import.meta.url)));
const raw=JSON.parse(readFileSync(new URL('../../planning/phase0/fixtures/graph-responses.json',import.meta.url))).responses;
function pair(){
 const envelopes=structuredClone(raw),number=25917718,timestamp=1788689000,hash='0x'+'a'.repeat(64);
 for(let i=0;i<2;i++){envelopes[i].fetchedAt=1788689100;envelopes[i].response.data._meta={deployment:sources[i].deploymentCid,hasIndexingErrors:false,block:{number,timestamp,hash}};}
 return {envelopes,context:{now:1788689100,head:{chainId:1,number:number+2,timestamp:timestamp+24},blocks:{[number]:{number,timestamp,hash}}}};
}
test('G-01/G-03/G-04 common consumer rejects single-source, CID change, mismatch and stale reuse',()=>{
 const p=pair();assert.deepEqual(evaluatePair(p.envelopes,sources,p.context).tuning,{spreadBps:28,intensityBps:900});
 assert.throws(()=>evaluatePair([p.envelopes[0]],sources,p.context));
 assert.throws(()=>evaluatePair(p.envelopes,[sources[0],sources[0]],p.context));
 const changed=structuredClone(p);changed.envelopes[1].response.data._meta.deployment='changed';assert.throws(()=>evaluatePair(changed.envelopes,sources,changed.context));
 assert.throws(()=>evaluatePair(p.envelopes,sources,{...p.context,now:p.context.now+121}));
 const disagreement=structuredClone(p);disagreement.envelopes[1].response.data.liquidityPoolHourlySnapshots[0].hourlyVolumeUSD='90000';assert.throws(()=>evaluatePair(disagreement.envelopes,sources,disagreement.context),/disagreement/);
});
test('G-06 collector sends identical queries, records RPC provenance and handles partial outage',async()=>{
 const p=pair(),requests=[];
 const request=async(url,payload)=>{
  requests.push(payload);
  if(payload.query)return p.envelopes[url.endsWith(sources[0].subgraphId)?0:1].response;
  if(payload.method==='eth_chainId')return {result:'0x1'};
  const b=payload.params[0]==='latest'?p.context.head:p.context.blocks[25917718];
  return {result:{number:'0x'+b.number.toString(16),timestamp:'0x'+b.timestamp.toString(16),hash:b.hash??'0x'+'b'.repeat(64)}};
 };
 const result=await collectPair({sources,query:'shared-query',apiKey:'test',now:()=>p.context.now,request});
 assert.equal(result.result,'COLLECTED');assert.equal(requests.filter(r=>r.query==='shared-query').length,2);
 assert.equal(evaluatePair(result.envelopes,sources,result.context).observations.length,2);
 const failed=await collectPair({sources,query:'shared-query',apiKey:'test',now:()=>p.context.now,request:async(url,payload)=>{if(url.endsWith(sources[1].subgraphId))throw Error('provider outage');return request(url,payload);}});
 assert.equal(failed.result,'UNAVAILABLE');assert.equal(failed.failures.length,1);assert.equal(failed.envelopes[1],null);
});
