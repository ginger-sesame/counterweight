import test from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {transactionRequest,inspectSigned,authorization} from '../../src/operations/signer.mjs';
const signer=privateKeyToAccount('0x'+'11'.repeat(32));
const tx={chainId:31337,nonce:1,gas:100000n,to:'0x'+'22'.repeat(20),value:0n,data:'0x1234',maxFeePerGas:1000000000n,maxPriorityFeePerGas:1000n,type:'eip1559'};
test('O-02 signer verifies recovered wallet and every unsigned transaction field',async()=>{
 const raw=await signer.signTransaction(tx),request=transactionRequest(tx);
 assert.equal((await inspectSigned(raw,request,signer.address)).from,signer.address);
 for(const [key,value] of Object.entries({chain_id:1,nonce:2,to:'0x'+'33'.repeat(20),value:'1',data:'0x',gas_limit:'1',max_fee_per_gas:'2',max_priority_fee_per_gas:'2'}))await assert.rejects(inspectSigned(raw,{...request,[key]:value},signer.address));
 await assert.rejects(inspectSigned(raw,request,'0x'+'44'.repeat(20)));
});
test('O-04 only explicit local-fork transactions and named signer contexts',()=>{
 assert.throws(()=>transactionRequest({...tx,chainId:1}));assert.throws(()=>transactionRequest({...tx,nonce:undefined}));assert.throws(()=>transactionRequest({...tx,authorizationList:[{}]}));
 const bundle={keys:{adminA:{privateKey:'A'},adminB:{privateKey:'B'},adminC:{privateKey:'C'},updater:{privateKey:'U'}}};
 assert.deepEqual(authorization(bundle),{authorization_private_keys:['A','B']});assert.deepEqual(authorization(bundle,'updater'),{authorization_private_keys:['U']});assert.throws(()=>authorization(bundle,'runtime'));
});
test('O-02 explicit legacy type is preserved and a returned type change is rejected',async()=>{
 const legacy={...tx,type:'legacy',gasPrice:2000000000n};delete legacy.maxFeePerGas;delete legacy.maxPriorityFeePerGas;
 const request=transactionRequest(legacy);assert.equal(request.type,0);assert.match(request.gas_price,/^0x/);
 const raw=await signer.signTransaction(legacy);await inspectSigned(raw,request,signer.address);
 await assert.rejects(inspectSigned(raw,{...request,type:2},signer.address),/transaction type/);
});
