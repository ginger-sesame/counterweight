import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
export function privyClient() {
  assert(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET, 'Privy app credentials required');
  return new PrivyClient({appId:process.env.PRIVY_APP_ID,appSecret:process.env.PRIVY_APP_SECRET,timeout:20000,maxRetries:0});
}
export async function saveJournal(path, value) {
  const temp=path+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temp,path);
}
export async function provision(client, bundle, path) {
  let journal;
  try{journal=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;journal={version:1,appId:process.env.PRIVY_APP_ID,runId:randomUUID(),resources:{}};await saveJournal(path,journal);}
  assert.equal(journal.appId,process.env.PRIVY_APP_ID,'journal app mismatch');
  async function resource(name, create, get) {
    if(journal.resources[name])return get(journal.resources[name].id);
    assert(!journal.pending, 'Unresolved remote creation; reconcile pending resource before retrying');
    journal.pending={name,idempotencyKey:randomUUID(),startedAt:new Date().toISOString()};await saveJournal(path,journal);
    const result=await create(journal.pending.idempotencyKey);
    journal.resources[name]=result;delete journal.pending;await saveJournal(path,journal);
    return get(result.id);
  }
  for(const [name,roles,threshold] of [['owner',['adminA','adminB','adminC'],2],['updater',['updater'],1],['emergency',['emergency'],1]]){
    const public_keys=roles.map(role=>bundle.keys[role].publicKey);
    const q=await resource(name,()=>client.keyQuorums().create({display_name:`Counterweight ${name} ${journal.runId.slice(0,8)}`,authorization_threshold:threshold,public_keys}),id=>client.keyQuorums().get(id));
    assert.equal(q.authorization_threshold,threshold);assert.deepEqual(q.authorization_keys.map(k=>k.public_key).sort(),[...public_keys].sort());
  }
  const ownerId=journal.resources.owner.id;
  const template=JSON.parse(await readFile(new URL('../../planning/phase0/fixtures/owner-policy.json',import.meta.url),'utf8'));
  template.owner_id=ownerId;template.name=`counterweight-owner-${journal.runId.slice(0,8)}`;
  const policy=await resource('ownerPolicy',idempotency_key=>client.policies().create({...template,idempotency_key}),id=>client.policies().get(id));
  assert.equal(policy.owner_id,ownerId);
  const wallet=await resource('wallet',idempotency_key=>client.wallets().create({chain_type:'ethereum',display_name:`Counterweight development ${journal.runId.slice(0,8)}`,owner_id:ownerId,policy_ids:[policy.id],idempotency_key}),id=>client.wallets().get(id));
  assert.equal(wallet.owner_id,ownerId);assert.deepEqual(wallet.policy_ids,[policy.id]);assert.equal(wallet.chain_type,'ethereum');
  return {journal,wallet};
}
