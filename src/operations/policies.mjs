import {getAddress} from 'viem';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {saveJournal} from './provision.mjs';
import {authorization} from './signer.mjs';
export function verifyPolicy(actual, expected) {
  for(const field of ['owner_id','version','chain_type'])assert.equal(actual[field],expected[field],`policy ${field}`);
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
  const rules=policy=>policy.rules.map(({id,...rule})=>({...rule,conditions:rule.conditions.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})).sort((a,b)=>a.name.localeCompare(b.name));
  assert.deepEqual(rules(actual),rules(expected),'exact self-contained policy rules');
}
export async function materializePolicy(role, ownerId, controller) {
  assert(['updater','emergency'].includes(role));assert(/^0x[0-9a-fA-F]{40}$/.test(controller));assert(typeof ownerId==='string'&&ownerId.length>0);
  const text=await readFile(new URL(`../../planning/phase0/fixtures/${role}-policy.json`,import.meta.url),'utf8');
  const result=JSON.parse(text.replaceAll('${OWNER_QUORUM_ID}',ownerId).replaceAll('${CONTROLLER_ADDRESS}',getAddress(controller)));
  assert(!JSON.stringify(result).includes('${'),'unresolved policy placeholders');return result;
}
export async function configureSigners(client,bundle,path,controller){
  const journal=JSON.parse(await readFile(path,'utf8'));assert(!journal.pending,'unresolved resource creation');
  const ownerId=journal.resources.owner.id;
  for(const role of ['updater','emergency']){
    const name=role+'Policy',template=await materializePolicy(role,ownerId,controller);
    if(!journal.resources[name]){
      journal.pending={name,idempotencyKey:randomUUID(),startedAt:new Date().toISOString()};await saveJournal(path,journal);
      journal.resources[name]=await client.policies().create({...template,idempotency_key:journal.pending.idempotencyKey});delete journal.pending;await saveJournal(path,journal);
    }else{
      await client.policies().update(journal.resources[name].id,{rules:template.rules,authorization_context:authorization(bundle)});
    }
    const policy=await client.policies().get(journal.resources[name].id);verifyPolicy(policy,template);journal.resources[name]=policy;
  }
  const additional_signers=['updater','emergency'].map(role=>({signer_id:journal.resources[role].id,override_policy_ids:[journal.resources[role+'Policy'].id]}));
  await client.wallets().update(journal.resources.wallet.id,{additional_signers,authorization_context:authorization(bundle)});
  const wallet=await client.wallets().get(journal.resources.wallet.id);
  assert.equal(wallet.owner_id,ownerId);const canonical=items=>items.map(s=>({signer_id:s.signer_id,override_policy_ids:[...s.override_policy_ids].sort()})).sort((a,b)=>a.signer_id.localeCompare(b.signer_id));
  assert.deepEqual(canonical(wallet.additional_signers),canonical(additional_signers));
  journal.resources.wallet=wallet;await saveJournal(path,journal);return journal;
}
