import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {provision} from '../../src/operations/provision.mjs';
import {materializePolicy} from '../../src/operations/policies.mjs';
test('O-01 policy materialization fixes owner, destination and self-contained restrictions',async()=>{
 for(const role of ['updater','emergency']){
  const policy=await materializePolicy(role,'owner-id','0x'+'11'.repeat(20));
  assert.equal(policy.owner_id,'owner-id');assert.equal(policy.rules.length,1);
  assert.equal(policy.rules[0].method,'eth_signTransaction');assert.equal(policy.rules[0].action,'ALLOW');
  assert(policy.rules[0].conditions.some(c=>c.field==='to'&&c.value==='0x'+'11'.repeat(20)));
  assert(policy.rules[0].conditions.some(c=>c.field==='chain_id'&&c.value==='31337'));
 }
 await assert.rejects(materializePolicy('updater','owner-id','bad-address'));
});
test('O-01 interrupted provisioning journals uncertainty and will not create duplicates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cw-privy-journal-'));let calls=0;
 const bundle={keys:Object.fromEntries(['adminA','adminB','adminC','updater','emergency'].map(r=>[r,{publicKey:r}]))};
 const client={keyQuorums:()=>({create:async()=>{calls++;throw Error('ambiguous timeout');}})};
 try{
  const path=join(dir,'journal.json');await assert.rejects(provision(client,bundle,path),/timeout/);
  assert.equal(JSON.parse(await readFile(path)).pending.name,'owner');
  await assert.rejects(provision(client,bundle,path),/reconcile/);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
