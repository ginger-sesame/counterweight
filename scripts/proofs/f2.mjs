#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runSettlement } from './settlement.mjs';
import { collectPair, DataUnavailable } from '../../src/data/fetch.mjs';
import { evaluatePair, updateArgs, validateTuning } from '../../src/data/regime.mjs';
const root=new URL('../../',import.meta.url);
await runSettlement(async ({client,read,send,setup,state,attempt,check,maker,W,erc20,controllerAbi,routerAbi,normalSnapshot,options})=>{
 const sources=JSON.parse(await readFile(new URL('planning/phase0/fixtures/sources.json',root)));
 const query=await readFile(new URL('planning/phase0/fixtures/regime.graphql',root),'utf8');
 const records=[];
 const save=async()=>writeFile(`${options.out}/graph.json`,JSON.stringify({sources,query,queryHash:createHash('sha256').update(query).digest('hex'),records},null,2).split(process.env.GRAPH_API_KEY||'__NO_KEY__').join('[REDACTED]'));
 async function collect(label){
  const collection=await collectPair({sources,query,apiKey:process.env.GRAPH_API_KEY,rpcUrl:process.env.ETHEREUM_RPC_URL||undefined});
  records.push({label,collection});await save();
  if(collection.result!=='COLLECTED') throw new DataUnavailable('two-source collection unavailable');
  const evaluated=evaluatePair(collection.envelopes,sources,collection.context);
  records.at(-1).evaluated=evaluated;await save();return {collection,evaluated};
 }
 async function update(s,pair,label){
  // Revalidate wall-clock freshness immediately before constructing the unsigned update.
  const evaluated=evaluatePair(pair.collection.envelopes,sources,{...pair.collection.context,now:Math.floor(Date.now()/1000)});
  const before=await state(s),config=await read(s.controller,controllerAbi,'config');
  const now=Number((await client.getBlock()).timestamp);
  const args=updateArgs(evaluated.tuning,before.version,now,s.config.end);
  await send(maker,s.controller,controllerAbi,'setTuning',args,0n,label);
  const after=await state(s),effective=await read(s.controller,controllerAbi,'effectiveTuning');
  check(`${label}: safety digest unchanged`,before.safetyDigest===after.safetyDigest);
  assert.deepEqual(await read(s.controller,controllerAbi,'config'),config);check(`${label}: full protected configuration unchanged`,true);
  check(`${label}: version increments`,after.version===before.version+1n);
  check(`${label}: actual bounded tuning`,effective.available&&effective.intensityBps===evaluated.tuning.intensityBps&&effective.spreadBps===evaluated.tuning.spreadBps);
  records.push({label,wallClockAtValidation:Math.floor(Date.now()/1000),forkTimestampAtUpdate:now,sourceDigest:evaluated.sourceDigest,unsignedArgs:args.map(String),controller:s.controller,safetyDigest:after.safetyDigest});await save();
  return evaluated.tuning;
 }
 const s=await setup(10,10n**19n,20000n*10n**6n);
 const live=await collect('initial live pair');const tuning=await update(s,live,'live bounded update');
 const expected=200000000n*BigInt(10000-tuning.spreadBps)/10000n;
 check('independent quote sensitivity to live spread',expected!==199400000n||tuning.spreadBps===30);
 const branch=await client.request({method:'evm_snapshot'});
 await attempt(s,'live safe WETH input',true,10n**17n,expected);
 check('reset live fill branch',await client.request({method:'evm_revert',params:[branch]}));
 // Failure inputs are independent copies; never overwrite retained live evidence.
 for(const kind of ['stale','malformed']){
  const bad=structuredClone(live.collection);
  if(kind==='stale')bad.envelopes[0].fetchedAt-=1000;
  else bad.envelopes[1].response.data.liquidityPoolDailySnapshot.dailyVolumeUSD='NaN';
  const before=await state(s);assert.throws(()=>evaluatePair(bad.envelopes,sources,bad.context));
  assert.deepEqual(await state(s),before);check(`${kind}: no update or protected state change`,true);
  records.push({label:`injected ${kind}`,injected:true,envelopes:bad.envelopes,result:'REJECTED'});
 }
 assert.throws(()=>validateTuning({...tuning,maxWethBps:9999}));check('forbidden field rejected before ABI construction',true);
 const ttl=await read(s.controller,controllerAbi,'tuningValidUntil');
 await client.request({method:'evm_setNextBlockTimestamp',params:[Number(ttl)+1]});await client.request({method:'evm_mine'});
 const fallback=await read(s.controller,controllerAbi,'effectiveTuning');check('TTL on-chain fallback',!fallback.available&&fallback.intensityBps===0&&fallback.spreadBps===100);
 await attempt(s,'fallback safe WETH input',true,10n**17n,198000000n);
 const recovered=await collect('same-controller fresh recovery pair');
 await update(s,recovered,'same-controller recovery update');
 // Reset the fork baseline to current wall time before the unsafe branch; branch identity is explicit.
 check('reset funded baseline for recovery and unsafe branch',await client.request({method:'evm_revert',params:[normalSnapshot]}));
 await send(maker,W,erc20,'deposit',[],4n*10n**18n,'fund F2 upper-bound WETH');
 const upper=await setup(11,14n*10n**18n,12000n*10n**6n);
 const recovery=await collect('fresh recovery pair');await update(upper,recovery,'recovery bounded update');
 await attempt(upper,'live unsafe WETH input',true,10n**17n,null,'ExposureOutOfBounds');
 const upperTtl=await read(upper.controller,controllerAbi,'tuningValidUntil');
 await client.request({method:'evm_setNextBlockTimestamp',params:[Number(upperTtl)+1]});await client.request({method:'evm_mine'});
 await attempt(upper,'fallback unsafe WETH input',true,10n**17n,null,'ExposureOutOfBounds');
 await save();
 const graphSourceHashes={};for(const path of ['src/data/normalize.mjs','src/data/regime.mjs','src/data/fetch.mjs','scripts/proofs/f2.mjs','planning/phase0/fixtures/sources.json','planning/phase0/fixtures/regime.graphql'])graphSourceHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
 return {graphSourceHashes,graphArtifact:'graph.json',operationsIdentity:'controlled local Anvil maker; Privy deferred to F3'};
});
