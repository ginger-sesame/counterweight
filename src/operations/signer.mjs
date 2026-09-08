import assert from 'node:assert/strict';
import { parseTransaction, recoverTransactionAddress, keccak256 } from 'viem';
import { toAccount } from 'viem/accounts';
export function transactionRequest(tx) {
  assert.equal(tx.chainId,31337,'Only the development fork may be signed');
  assert(Number.isSafeInteger(tx.nonce)&&tx.nonce>=0,'explicit transaction nonce');
  assert(tx.gas>0n,'explicit gas limit');
  assert(!tx.authorizationList?.length&&!tx.blobs&&!tx.accessList?.length,'unsupported transaction extras');
  const request={chain_id:31337,nonce:tx.nonce,gas_limit:'0x'+tx.gas.toString(16),value:'0x'+(tx.value??0n).toString(16),data:tx.data??'0x'};
  if(tx.to)request.to=tx.to;
  if(tx.gasPrice!=null){request.type=0;request.gas_price='0x'+tx.gasPrice.toString(16);}
  else {request.type=2;assert(tx.maxFeePerGas!=null&&tx.maxPriorityFeePerGas!=null,'explicit fees');request.max_fee_per_gas='0x'+tx.maxFeePerGas.toString(16);request.max_priority_fee_per_gas='0x'+tx.maxPriorityFeePerGas.toString(16);}
  return request;
}
export async function inspectSigned(raw, expected, address) {
  const decoded=parseTransaction(raw);
  assert.equal((await recoverTransactionAddress({serializedTransaction:raw})).toLowerCase(),address.toLowerCase(),'Privy recovered maker');
  assert.equal(decoded.type,expected.type===0?'legacy':'eip1559','signed transaction type');
  assert.equal(decoded.chainId,expected.chain_id,'signed chain');assert.equal(decoded.nonce,expected.nonce,'signed nonce');
  assert.equal(decoded.to?.toLowerCase(),expected.to?.toLowerCase(),'signed destination');
  assert.equal(decoded.data??'0x',expected.data??'0x','signed calldata');
  for(const [field,wire] of [['value','value'],['gas','gas_limit'],['gasPrice','gas_price'],['maxFeePerGas','max_fee_per_gas'],['maxPriorityFeePerGas','max_priority_fee_per_gas']]){
    if(expected[wire]!=null)assert.equal(decoded[field]??0n,BigInt(expected[wire]),`signed ${field}`);
  }
  assert(!decoded.authorizationList?.length&&!decoded.accessList?.length,'signed unexpected authorization/access list');
  return {hash:keccak256(raw),from:address,request:expected};
}
export function authorization(bundle, role='owner') {
  const roles=role==='owner'?['adminA','adminB']:[role];
  return {authorization_private_keys:roles.map(r=>{assert(bundle.keys[r], 'unknown signer role');return bundle.keys[r].privateKey;})};
}
export function privyAccount(client, wallet, bundle, records) {
  return toAccount({address:wallet.address,
    async signTransaction(tx){
      try {
      const transaction=transactionRequest(tx);
      const result=await client.wallets().ethereum().signTransaction(wallet.id,{params:{transaction},authorization_context:authorization(bundle)});
      records.push({role:'owner',...(await inspectSigned(result.signed_transaction,transaction,wallet.address))});
      return result.signed_transaction;
      }catch(error){records.push({role:'owner',result:'FAIL',status:error.status??null,errorClass:error.constructor.name,reason:error instanceof assert.AssertionError?error.message:undefined,providerCode:error.error?.code});throw error;}
    },
    async signMessage(){throw Error('Message signing forbidden');},
    async signTypedData(){throw Error('Typed-data signing forbidden');},
  });
}
// Reconcile a signed operation before broadcasting. Never obtain a replacement signature here.
export async function broadcastOnce(chain, raw, address) {
  const hash=keccak256(raw),tx=parseTransaction(raw);
  assert.equal(tx.chainId,31337,'broadcast chain');assert.equal(await chain.getChainId(),31337,'broadcast RPC chain');
  const missing=e=>['TransactionReceiptNotFoundError','TransactionNotFoundError'].includes(e.name);
  try{return {hash,receipt:await chain.getTransactionReceipt({hash}),reused:true};}catch(e){if(!missing(e))throw e;}
  try{await chain.getTransaction({hash});return {hash,receipt:await chain.waitForTransactionReceipt({hash,timeout:30000}),reused:true};}catch(e){if(!missing(e))throw e;}
  assert.equal(await chain.getTransactionCount({address,blockTag:'pending'}),tx.nonce,'nonce changed; reconcile before a new operation');
  assert.equal(await chain.sendRawTransaction({serializedTransaction:raw}),hash,'broadcast hash');
  return {hash,receipt:await chain.waitForTransactionReceipt({hash,timeout:30000}),reused:false};
}
