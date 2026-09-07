import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec=promisify(execFile);
test('F1 CLI settles canonical tokens and proves atomic rejections on a fresh mainnet fork',{timeout:240000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'counterweight-f1-e2e-'));const out=join(dir,'proof');
 try{
  const result=await exec(process.execPath,['scripts/proofs/f1.mjs','--out',out],{timeout:220000,maxBuffer:1024*1024});
  assert.equal(JSON.parse(result.stdout).result,'PASS');
  const load=async name=>JSON.parse(await readFile(join(out,name),'utf8'));
  const manifest=await load('manifest.json'),scenarios=await load('scenarios.json'),txs=await load('transactions.json');
  assert.equal(manifest.gate,'F1');assert.equal(manifest.chainId,31337);assert.equal(manifest.forkBlock,'25917718');
  assert.match(manifest.toolVersions.forge,/1\.8\.1/);assert.match(manifest.toolVersions.solidity,/^0\.8\.30/);assert.equal(manifest.dependencyVersions['@openzeppelin/contracts'].version,'5.4.0');
  assert(manifest.sourceHashes['planning/phase0/ACCOUNTING.md']);
  assert.equal(scenarios.length,5);assert.equal(scenarios.filter(s=>!s.error).length,2);
  for(const s of scenarios){
   const tx=txs.find(t=>t.hash===s.transaction&&t.label===s.label);assert(tx);
   assert.equal(tx.status,s.error?'reverted':'success');
   if(s.error){assert.deepEqual(s.before,s.after);assert(s.revertData);}
  }
  assert.equal(scenarios.filter(s=>s.error==='ExposureOutOfBounds').length,2);
  assert.equal(scenarios.filter(s=>s.error==='SafeTransferFromFailed').length,1);
  assert((await load('assertions.json')).every(a=>a.result==='PASS'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('F1 CLI rejects a nonlocal RPC before sending a transaction',{timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'counterweight-f1-denied-'));const out=join(dir,'proof');
 try{
  let result;try{await exec(process.execPath,['scripts/proofs/f1.mjs','--rpc','https://ethereum.example','--out',out],{timeout:25000});assert.fail('nonlocal RPC accepted');}catch(e){result=e;}
  assert.equal(result.code,1);assert.match(JSON.parse(result.stderr).error,/loopback/);
  const failure=JSON.parse(await readFile(join(out,'failure.json'),'utf8'));assert.deepEqual(failure.transactions,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
