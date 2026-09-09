import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const exec=promisify(execFile);
test('F4 CLI joins live providers, continuous settlement failures and process restart',{timeout:360000},async()=>{
 for(const key of ['GRAPH_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET'])assert(process.env[key],`${key} required; F4 cannot skip`);
 const dir=await mkdtemp(join(tmpdir(),'counterweight-f4-e2e-')),out=join(dir,'proof');
 try {
  const result=await exec(process.execPath,['scripts/proofs/mvp.mjs','--out',out],{timeout:340000,maxBuffer:1024*1024});assert.equal(JSON.parse(result.stdout).gate,'F4');
  const load=async file=>JSON.parse(await readFile(join(out,file),'utf8'));
  const manifest=await load('manifest.json'),scenarios=await load('scenarios.json'),graph=await load('graph.json'),operations=await load('operations.json'),assertions=await load('assertions.json'),restart=await load('restart.json'),transactions=await load('transactions.json');
  assert.equal(manifest.result,'PASS');assert.deepEqual(manifest.testIds,['E-01','E-02','E-03']);assert.equal(manifest.epochs.length,1);assert.equal(manifest.epochs[0].config.epochId,'30');assert(manifest.runId);
  assert(assertions.length>=80&&assertions.every(x=>x.result==='PASS'));
  assert.equal(scenarios.length,7);assert(scenarios.every(x=>x.branch==='30'));
  for(const label of ['E-01 200 USDC inventory-seeking fill','E-02 intervening inventory fill','E-02 fallback recovery-direction fill'])assert(scenarios.some(x=>x.label===label&&!x.error));
  assert.deepEqual(scenarios.filter(x=>x.error).map(x=>x.error),['ExposureOutOfBounds','ExposureOutOfBounds','SafeTransferFromFailed','Paused']);
  for(const scenario of scenarios.filter(x=>x.error))assert.deepEqual(scenario.before,scenario.after);
  const primary=scenarios[0];assert.equal(primary.amountIn,'200000000');assert.equal(primary.before.allocations[0],'14000000000000000000');assert.equal(primary.before.allocations[1],'12000000000');
  // There are no intervening inventory mutations or resets between recorded attempts.
  for(let i=1;i<scenarios.length;i++)assert.deepEqual(scenarios[i].before.allocations,scenarios[i-1].after.allocations);
  for(let i=1;i<transactions.length;i++)assert(BigInt(transactions[i].blockNumber)>BigInt(transactions[i-1].blockNumber),'strictly increasing uninterrupted blocks');
  const live=graph.filter(x=>!x.injected);assert.equal(live.length,3);
  for(const pair of live){assert.equal(pair.collection.result,'COLLECTED');assert.equal(new Set(pair.evaluated.observations.map(x=>x.deploymentCid)).size,2);assert(pair.evaluated.observations.every(x=>x.windowSeconds===86400));assert.equal(pair.controller,manifest.epochs[0].controller);assert(transactions.some(x=>x.hash===pair.transactionHash));}
  assert.equal(operations.length,2);assert.equal(operations[0].failure.code,'policy_violation');assert.equal(operations[1].kind,'authorization');for(const op of operations){assert(op.failure.correlationId);assert.deepEqual(op.before,op.after);}
  assert.equal(restart.result.status,'CONFIRMED');assert.equal(restart.result.action,'DO_NOT_REPEAT');assert.equal(restart.nonceBefore,restart.nonceAfter);assert.equal(restart.signatureCountBefore,restart.signatureCountAfter);assert(transactions.some(x=>x.hash===restart.result.transactionHash));
  for(const file of ['manifest.json',...manifest.artifacts]){const text=await readFile(join(out,file),'utf8');for(const key of ['GRAPH_API_KEY','PRIVY_APP_SECRET'])assert(!text.includes(process.env[key]));assert(!/"(?:signed_transaction|authorization_private_keys|privateKey)"\s*:/.test(text));}
 } finally {await rm(dir,{recursive:true,force:true});}
});
