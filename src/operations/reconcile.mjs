import assert from 'node:assert/strict';
import {keccak256} from 'viem';

// Read-only restart reconciliation. Deliberately accepts no signer or raw transaction.
// A receipt and market-data freshness answer different questions.
export async function reconcileCheckpoint(chain, checkpoint, {now=Math.floor(Date.now()/1000)}={}) {
  assert.equal(checkpoint.schemaVersion,1,'checkpoint schema');
  assert.equal(checkpoint.chainId,31337,'checkpoint development chain');
  assert.equal(await chain.getChainId(),checkpoint.chainId,'restart chain identity');
  const anchor=await chain.getBlock({blockNumber:BigInt(checkpoint.anchor.number)});
  assert.equal(anchor.hash,checkpoint.anchor.hash,'restart deployment history');
  assert.equal(keccak256(await chain.getCode({address:checkpoint.controller})),checkpoint.codeHash,'restart controller code');
  const digest=await chain.readContract({address:checkpoint.controller,abi:[{type:'function',name:'safetyDigest',stateMutability:'view',inputs:[],outputs:[{type:'bytes32'}]}],functionName:'safetyDigest'});
  assert.equal(digest,checkpoint.safetyDigest,'restart immutable configuration');
  assert(/^0x[0-9a-fA-F]{64}$/.test(checkpoint.transactionHash),'checkpoint transaction hash');
  assert(Number.isSafeInteger(checkpoint.observationFetchedAt)&&Number.isSafeInteger(now),'checkpoint freshness timestamps');
  const age=now-checkpoint.observationFetchedAt;
  const observationFresh=age>=0&&age<=120;
  let receipt;
  try { receipt=await chain.getTransactionReceipt({hash:checkpoint.transactionHash}); }
  catch(error) {
    if(error.name!=='TransactionReceiptNotFoundError')throw error;
    try {
      await chain.getTransaction({hash:checkpoint.transactionHash});
      return {status:'PENDING',observationFresh,action:'WAIT',transactionHash:checkpoint.transactionHash};
    } catch(pendingError) {
      if(pendingError.name!=='TransactionNotFoundError')throw pendingError;
      return {status:'UNKNOWN',observationFresh,action:'MANUAL_RECONCILIATION',transactionHash:checkpoint.transactionHash};
    }
  }
  assert.equal(receipt.transactionHash,checkpoint.transactionHash,'restart receipt identity');
  assert.equal(receipt.from.toLowerCase(),checkpoint.maker.toLowerCase(),'restart transaction sender');
  assert.equal(receipt.to?.toLowerCase(),checkpoint.controller.toLowerCase(),'restart transaction target');
  // Check canonical inclusion, including after a fork reversion/reorganization.
  const included=await chain.getBlock({blockNumber:receipt.blockNumber});
  assert.equal(included.hash,receipt.blockHash,'restart canonical receipt');
  return {status:receipt.status==='success'?'CONFIRMED':'REVERTED',observationFresh,action:'DO_NOT_REPEAT',transactionHash:checkpoint.transactionHash,blockNumber:receipt.blockNumber.toString()};
}
