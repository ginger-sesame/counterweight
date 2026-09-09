import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {reconcileCheckpoint} from '../../src/operations/reconcile.mjs';
const hash='0x'+'a'.repeat(64),maker='0x'+'1'.repeat(40),controller='0x'+'2'.repeat(40);
const checkpoint={schemaVersion:1,chainId:31337,anchor:{number:10,hash:'anchor'},controller,codeHash:keccak256('0x1234'),safetyDigest:'safety',transactionHash:hash,maker,observationFetchedAt:1000};
const missing=name=>Object.assign(new Error(name),{name});
function fixture(overrides={}) {return {getChainId:async()=>31337,getBlock:async({blockNumber})=>({hash:blockNumber===10n?'anchor':'included'}),getCode:async()=>'0x1234',readContract:async()=>'safety',getTransactionReceipt:async()=>({transactionHash:hash,from:maker,to:controller,blockNumber:11n,blockHash:'included',status:'success'}),...overrides};}
test('E-03 restart recognizes mined operation independently from observation expiry',async()=>{
 const chain=fixture();
 assert.deepEqual(await reconcileCheckpoint(chain,checkpoint,{now:1120}),{status:'CONFIRMED',fetchAgeAcceptable:true,action:'DO_NOT_REPEAT',newUpdateAction:'COLLECT_AND_VALIDATE_NEW_PAIR',transactionHash:hash,blockNumber:'11'});
 assert.equal((await reconcileCheckpoint(chain,checkpoint,{now:1121})).fetchAgeAcceptable,false);
 assert.equal((await reconcileCheckpoint(chain,checkpoint,{now:999})).fetchAgeAcceptable,false);
 assert.equal((await reconcileCheckpoint(fixture({getTransactionReceipt:async()=>({...await chain.getTransactionReceipt(),status:'reverted'})}),checkpoint,{now:1000})).status,'REVERTED');
});
test('E-03 pending and absent hashes never trigger signing or rebroadcast',async()=>{
 const absent={getTransactionReceipt:async()=>{throw missing('TransactionReceiptNotFoundError')}};
 assert.equal((await reconcileCheckpoint(fixture({...absent,getTransaction:async()=>({hash})}),checkpoint,{now:1000})).action,'WAIT');
 assert.equal((await reconcileCheckpoint(fixture({...absent,getTransaction:async()=>{throw missing('TransactionNotFoundError')}}),checkpoint,{now:1000})).action,'MANUAL_RECONCILIATION');
});
test('E-03 network uncertainty propagates rather than being classified as absence',async()=>{
 for(const overrides of [{getTransactionReceipt:async()=>{throw Error('transport')}},{getTransactionReceipt:async()=>{throw missing('TransactionReceiptNotFoundError')},getTransaction:async()=>{throw Error('transport')}}])await assert.rejects(reconcileCheckpoint(fixture(overrides),checkpoint,{now:1000}),/transport/);
});
test('E-03 rejects wrong chain, changed history, code, configuration and receipt identities',async()=>{
 const good=fixture(),receipt=await good.getTransactionReceipt();
 for(const overrides of [{getChainId:async()=>1},{getBlock:async()=>({hash:'other'})},{getCode:async()=>'0x5678'},{readContract:async()=>'changed'},...['from','to','transactionHash','blockHash'].map(field=>({getTransactionReceipt:async()=>({...receipt,[field]:'0xdead'})}))])await assert.rejects(reconcileCheckpoint(fixture(overrides),checkpoint,{now:1000}));
});
