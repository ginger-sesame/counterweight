import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec=promisify(execFile);
test('F2 public CLI consumes two live sources and settles under fresh and fallback tuning',{timeout:240000},async()=>{
 assert(process.env.GRAPH_API_KEY,'GRAPH_API_KEY required; live test cannot be skipped');
 const dir=await mkdtemp(join(tmpdir(),'counterweight-f2-'));
 try{
  const out=join(dir,'proof');
  const run=await exec(process.execPath,['scripts/proofs/f2.mjs','--out',out],{timeout:220000,maxBuffer:1024*1024});
  assert.equal(JSON.parse(run.stdout).gate,'F2');
  const load=async file=>JSON.parse(await readFile(join(out,file),'utf8'));
  const manifest=await load('manifest.json'),graph=await load('graph.json'),scenarios=await load('scenarios.json'),transactions=await load('transactions.json');
  assert.equal(manifest.result,'PASS');assert.equal(manifest.chainId,31337);assert.equal(manifest.forkBlock,'25917718');
  assert.equal(new Set(graph.sources.map(s=>s.deploymentCid)).size,2);
  const live=graph.records.filter(r=>r.evaluated);assert.equal(live.length,3);
  for(const record of live){assert.equal(record.evaluated.observations.length,2);assert(record.evaluated.tuning.spreadBps>=10&&record.evaluated.tuning.spreadBps<=100);}
  assert.equal(graph.records.filter(r=>r.injected&&r.result==='REJECTED').length,2);
  assert.equal(scenarios.length,4);
  for(const scenario of scenarios){
   const tx=transactions.find(t=>t.hash===scenario.transaction&&t.label===scenario.label);assert(tx);assert.equal(tx.status,scenario.error?'reverted':'success');
   if(scenario.error){assert.equal(scenario.error,'ExposureOutOfBounds');assert.deepEqual(scenario.before,scenario.after);}
  }
  const assertions=await load('assertions.json');assert(assertions.length>=80);assert(assertions.every(a=>a.result==='PASS'));
  assert(assertions.some(a=>a.name==='same-controller recovery update: version increments'));
  for(const file of ['manifest.json','graph.json','transactions.json','scenarios.json','assertions.json'])assert(!(await readFile(join(out,file),'utf8')).includes(process.env.GRAPH_API_KEY));
 }finally{await rm(dir,{recursive:true,force:true});}
});
