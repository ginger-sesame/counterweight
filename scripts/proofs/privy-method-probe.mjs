#!/usr/bin/env node
// Read existing resources and probe alternate methods without broadcasting to a public network.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadKeys} from '../../src/operations/keys.mjs';
import {privyClient} from '../../src/operations/provision.mjs';
import {authorization} from '../../src/operations/signer.mjs';
const output=process.argv[2];assert(output,'Provide a fresh output JSON path');
const client=privyClient(),bundle=await loadKeys(process.env.PRIVY_KEYS_FILE||'.secrets/privy-development.json');
const journal=JSON.parse(await readFile(process.env.PRIVY_RESOURCES_FILE||'.secrets/privy-resources.json'));
const wallet=await client.wallets().get(journal.resources.wallet.id),results=[];
const transaction={chain_id:31337,type:0,nonce:0,to:wallet.address,value:'0x0',data:'0x',gas_limit:'0x5208',gas_price:'0x3b9aca00'};
const requests={
 signUserOperation:{params:{chain_id:31337,contract:'0x69007702764179f14F51cdce752f4f775d74E139',user_operation:{sender:wallet.address,nonce:'0x0',call_data:'0x',call_gas_limit:'0x30d40',verification_gas_limit:'0x30d40',pre_verification_gas:'0x5208',max_fee_per_gas:'0xf4240',max_priority_fee_per_gas:'0xf4240',paymaster:'0x0000000000000000000000000000000000000000',paymaster_data:'0x',paymaster_verification_gas_limit:'0x0',paymaster_post_op_gas_limit:'0x0'}}},
 sendTransaction:{caip2:'eip155:31337',params:{transaction}},
 sendCalls:{caip2:'eip155:31337',params:{calls:[{to:wallet.address,value:'0x0',data:'0x'}]}}
};
for(const role of ['updater','emergency'])for(const [method,request] of Object.entries(requests)){
 let failure;try{await client.wallets().ethereum()[method](wallet.id,{...request,authorization_context:authorization(bundle,role)});}catch(e){failure={status:e.status??null,code:e.error?.code??null,reason:e.error?.error??null,correlationId:e.headers?.get?.('x-request-id')||e.headers?.get?.('cf-ray')||null};}
 results.push({role,method,request,failure,result:failure?.code==='policy_violation'?'POLICY_DENIED':failure?'UNPROVEN':'UNEXPECTED_ALLOW'});
}
assert.deepEqual(await client.wallets().get(wallet.id),wallet,'readback wallet unchanged');
const result=results.every(r=>r.result==='POLICY_DENIED')?'PASS':'UNPROVEN';
await writeFile(output,JSON.stringify({runAt:new Date().toISOString(),result,walletId:wallet.id,chainId:31337,limitations:['No local RPC state assertion; this diagnostic does not replace the integrated F3 full matrix.','No policy changes and no public-network broadcast requested.'],results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({result,out:output}));if(result!=='PASS')process.exitCode=1;
