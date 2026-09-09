#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {encodeFunctionData,parseAbi,keccak256,createPublicClient,http} from 'viem';
import {generateP256KeyPair} from '@privy-io/node';
import {loadKeys} from '../../src/operations/keys.mjs';
import {privyClient,provision} from '../../src/operations/provision.mjs';
import {privyAccount,authorization,transactionRequest,inspectSigned,broadcastOnce} from '../../src/operations/signer.mjs';
import {configureSigners} from '../../src/operations/policies.mjs';
import {collectPair,DataUnavailable} from '../../src/data/fetch.mjs';
import {evaluatePair,updateArgs} from '../../src/data/regime.mjs';
import {runSettlement} from './settlement.mjs';
const root=new URL('../../',import.meta.url),stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
try{
 const bundle=await loadKeys(process.env.PRIVY_KEYS_FILE||'.secrets/privy-development.json'),privy=privyClient();
 const resourcePath=process.env.PRIVY_RESOURCES_FILE||'.secrets/privy-resources.json';
 const {wallet}=await provision(privy,bundle,resourcePath);
 const signatures=[],operations=[],graph=[],recoveryTraces=[];let output;
 const account=privyAccount(privy,wallet,bundle,signatures);
 await runSettlement(async h=>{
  const {setup,attempt,options,client:chain,read,state,check,maker,taker,controllerAbi,routerAbi,transactions,send,W,U,erc20,normalSnapshot,aqua,aquaAbi}=h;output=options.out;
  const save=async()=>{for(const [file,value] of Object.entries({'privy-signatures':signatures,'privy-operations':operations,'graph':graph,'privy-recovery-traces':recoveryTraces}))await writeFile(`${output}/${file}.json`,stringify(value)+'\n');};
  const s=await setup(20,10n**19n,20000n*10n**6n);
  const journal=await configureSigners(privy,bundle,resourcePath,s.controller);
  await writeFile(`${output}/privy-configuration.json`,stringify({custody:bundle.custody,wallet:await privy.wallets().get(wallet.id),quorums:await Promise.all(['owner','updater','emergency'].map(r=>privy.keyQuorums().get(journal.resources[r].id))),policies:await Promise.all(['ownerPolicy','updaterPolicy','emergencyPolicy'].map(r=>privy.policies().get(journal.resources[r].id)))})+'\n');
  const auth=role=>role==='runtime'?{}:authorization(bundle,role);
  async function request(to,data,value=0n){return transactionRequest({chainId:31337,nonce:await chain.getTransactionCount({address:maker}),to,data,value,gas:8000000n,gasPrice:await chain.getGasPrice()});}
  async function signing(role,transaction,authorization_context=auth(role)){
   let result;try{result=await privy.wallets().ethereum().signTransaction(wallet.id,{params:{transaction},authorization_context,idempotency_key:randomUUID()});}catch(e){e.publicRequest={role,method:'eth_signTransaction',transaction};throw e;}
   signatures.push({role,...await inspectSigned(result.signed_transaction,transaction,maker)});await save();return result.signed_transaction;
  }
  async function broadcast(raw,label,expected='success'){
   const {hash,receipt}=await broadcastOnce(chain,raw,maker);
   const nonceAfter=await chain.getTransactionCount({address:maker});const replay=await broadcastOnce(chain,raw,maker);check(`${label}: receipt reconciliation prevents duplicate broadcast`,replay.reused&&replay.hash===hash&&await chain.getTransactionCount({address:maker})===nonceAfter);
   check(`${label}: receipt`,receipt.status===expected);transactions.push({label,hash,status:receipt.status,blockNumber:receipt.blockNumber,logs:receipt.logs});return {hash,receipt};
  }
  async function call(role,target,abi,functionName,args=[],label=functionName){
   const transaction=await request(target,encodeFunctionData({abi,functionName,args}));return broadcast(await signing(role,transaction),label);
  }
  async function snapshot(target=s){return {strategy:await state(target),nonce:await chain.getTransactionCount({address:maker}),nativeBalance:await chain.getBalance({address:maker})};}
  async function deny(label,operation,{kind='policy',target=s,remote}={}){
   const before=await snapshot(target),resourceBefore=remote?await remote():undefined;let failure,request;
   try{await operation();}catch(e){request=e.publicRequest;failure={status:e.status??null,code:e.error?.code??null,reason:e.error?.error??null,correlationId:e.headers?.get?.('x-request-id')||e.headers?.get?.('cf-ray')||null};}
   operations.push({label,expected:'DENIED',kind,request,failure,before,after:await snapshot(target),resourceBefore,resourceAfter:remote?await remote():undefined});await save();
   assert(failure,`${label}: provider unexpectedly allowed request`);
   if(kind==='policy')assert.equal(failure.code,'policy_violation',`${label}: must be policy denial`);
   else assert([400,401,403].includes(failure.status)&&/authorization|signature|quorum|signer|owner|permission/i.test((failure.code??'')+' '+(failure.reason??'')),`${label}: must be authorization denial`);
   assert(failure.correlationId,`${label}: provider correlation identity required`);
   assert.deepEqual(operations.at(-1).after,before,`${label}: unchanged chain state`);
   if(remote)assert.deepEqual(operations.at(-1).resourceAfter,resourceBefore,`${label}: unchanged remote resource`);
   check(`${label}: intended denial and unchanged state`,true);
  }
  const sources=JSON.parse(await readFile(new URL('planning/phase0/fixtures/sources.json',root))),query=await readFile(new URL('planning/phase0/fixtures/regime.graphql',root),'utf8');
  async function liveUpdate(target,label){
   if(process.env.CW_PRIVY_DIAGNOSTIC==='1'){
    const version=await read(target.controller,controllerAbi,'tuningVersion');
    await call('updater',target.controller,controllerAbi,'setTuning',[900n,28n,version,Number((await chain.getBlock()).timestamp)+300],label+' [synthetic diagnostic]');
    graph.push({label,synthetic:true,result:'DIAGNOSTIC ONLY'});await save();return {intensityBps:900,spreadBps:28};
   }
   const collection=await collectPair({sources,query,apiKey:process.env.GRAPH_API_KEY,rpcUrl:process.env.ETHEREUM_RPC_URL||undefined});
   graph.push({label,sources,query,collection});await save();
   if(collection.result!=='COLLECTED')throw new DataUnavailable('Graph pair unavailable for F3');const evaluated=evaluatePair(collection.envelopes,sources,{...collection.context,now:Math.floor(Date.now()/1000)});
   graph.at(-1).evaluated=evaluated;await save();
   const before=await state(target),config=await read(target.controller,controllerAbi,'config');
   const args=updateArgs(evaluated.tuning,before.version,Number((await chain.getBlock()).timestamp),target.config.end);
   await call('updater',target.controller,controllerAbi,'setTuning',args,label);
   const after=await state(target),effective=await read(target.controller,controllerAbi,'effectiveTuning');
   assert.deepEqual(await read(target.controller,controllerAbi,'config'),config);check(`${label}: immutable safety`,before.safetyDigest===after.safetyDigest&&after.version===before.version+1n);
   check(`${label}: actual mapped tuning`,effective.available&&effective.intensityBps===evaluated.tuning.intensityBps&&effective.spreadBps===evaluated.tuning.spreadBps);
   return evaluated.tuning;
  }
  const tuning=await liveUpdate(s,'live Graph through Privy updater');
  const args=[900n,28n,await read(s.controller,controllerAbi,'tuningVersion'),Number((await chain.getBlock()).timestamp)+300];
  const valid=await request(s.controller,encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args}));
  for(const [intensity,spread] of [[0n,10n],[1000n,100n]]){
   const boundaryArgs=[intensity,spread,args[2],args[3]];
   await chain.simulateContract({account:maker,address:s.controller,abi:controllerAbi,functionName:'setTuning',args:boundaryArgs});
   await signing('updater',{...valid,data:encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:boundaryArgs})});check(`updater accepts exact boundary ${intensity}/${spread}`,true);
  }
  const invalidOwnerBefore=await state(s);
  const invalidOwner=await signing('owner',await request(s.controller,encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:[2n**256n-1n,30n,args[2],args[3]]})));
  const invalidOwnerResult=await broadcast(invalidOwner,'owner out-of-range update','reverted');
  const ownerTrace=await chain.request({method:'debug_traceTransaction',params:[invalidOwnerResult.hash,{disableMemory:true,disableStorage:true,disableStack:true}]});
  check('owner cannot bypass on-chain tuning bounds',ownerTrace.failed&&String(ownerTrace.returnValue).replace(/^0x/,'').startsWith(keccak256(new TextEncoder().encode('InvalidTuning()')).slice(2,10)));assert.deepEqual(await state(s),invalidOwnerBefore);
  const pristine=await chain.request({method:'evm_snapshot'});
  await attempt(s,'Privy live safe WETH fill',true,10n**17n,200000000n*BigInt(10000-tuning.spreadBps)/10000n);
  check('reset safe fill branch',await chain.request({method:'evm_revert',params:[pristine]}));
  const secondBranch=await chain.request({method:'evm_snapshot'}),second=await setup(21,10n**18n,2000n*10n**6n);
  const wrongArgs=[900n,28n,await read(second.controller,controllerAbi,'tuningVersion'),Number((await chain.getBlock()).timestamp)+300];
  await chain.simulateContract({account:maker,address:second.controller,abi:controllerAbi,functionName:'setTuning',args:wrongArgs});check('wrong target request succeeds in on-chain simulation',true);
  const wrongTarget=await request(second.controller,encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:wrongArgs}));
  await deny('updater wrong controller',()=>signing('updater',wrongTarget),{target:second});
  check('reset wrong controller branch',await chain.request({method:'evm_revert',params:[secondBranch]}));
  const negativeRequests=[
   ['wrong development chain',{...valid,chain_id:31338}],['native value',{...valid,value:'0x1'}],
   ['deploy replacement',{...valid,to:undefined,data:'0x60006000f3'}],
   ['approval widening',await request(U,encodeFunctionData({abi:erc20,functionName:'approve',args:[taker,2n**256n-1n]}))],
   ['treasury transfer',await request(U,encodeFunctionData({abi:erc20,functionName:'transfer',args:[taker,1n]}))],
   ...['pause','resume'].map(functionName=>[functionName,{...valid,data:encodeFunctionData({abi:controllerAbi,functionName})}]),
   ...[[1001n,30n],[1000n,9n],[1000n,101n],[65536n,30n],[2n**256n-1n,30n]].map(([i,spread])=>[`invalid tuning ${i}/${spread}`,{...valid,data:encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:[i,spread,args[2],args[3]]})}]),
  ];
  negativeRequests.push(['dock liquidity',await request(aqua,encodeFunctionData({abi:aquaAbi,functionName:'dock',args:[s.router,s.orderHash,[W,U]]}))]);
  for(const [label,tx] of negativeRequests)await deny(`updater ${label}`,()=>signing('updater',tx));
  await deny('runtime has no authorization',()=>signing('runtime',valid),{kind:'authorization'});
  await deny('one owner key cannot sign',()=>signing('adminA',valid),{kind:'authorization'});
  await deny('emergency cannot tune',()=>signing('emergency',valid));
  for(const role of ['updater','emergency']){
  await deny(`${role} personal signing`,()=>privy.wallets().ethereum().signMessage(wallet.id,{message:'Counterweight policy test',authorization_context:auth(role)}));
  await deny(`${role} typed signing`,()=>privy.wallets().ethereum().signTypedData(wallet.id,{params:{typed_data:{domain:{name:'Counterweight',version:'1',chainId:31337,verifyingContract:s.controller},types:{EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],Probe:[{name:'value',type:'uint256'}]},primary_type:'Probe',message:{value:'1'}}},authorization_context:auth(role)}));
  }
  const pauseRequest={...valid,data:encodeFunctionData({abi:controllerAbi,functionName:'pause'})};
  for(const [label,tx] of [['wrong chain',{...pauseRequest,chain_id:31338}],['native value',{...pauseRequest,value:'0x1'}],['wrong target',{...pauseRequest,to:taker}],...negativeRequests.filter(([name])=>['deploy replacement','approval widening','treasury transfer','dock liquidity'].includes(name))])await deny(`emergency ${label}`,()=>signing('emergency',tx));
  await deny('owner commissioning value cap',()=>signing('owner',{...valid,value:'0x'+(21n*10n**18n).toString(16)}));
  for(const role of ['updater','emergency']){
   await deny(`${role} raw secp256k1 signing`,()=>privy.wallets().ethereum().signSecp256k1(wallet.id,{params:{hash:'0x'+'12'.repeat(32)},authorization_context:auth(role)}));
   await deny(`${role} code delegation signing`,()=>privy.wallets().ethereum().sign7702Authorization(wallet.id,{params:{chain_id:31337,contract:s.controller,nonce:0},authorization_context:auth(role)}));
   await deny(`${role} provider broadcast method`,()=>privy.wallets().ethereum().sendTransaction(wallet.id,{caip2:'eip155:31337',params:{transaction:valid},authorization_context:auth(role)}));
   await deny(`${role} user operation signing`,()=>privy.wallets().ethereum().signUserOperation(wallet.id,{params:{chain_id:31337,contract:'0x69007702764179f14F51cdce752f4f775d74E139',user_operation:{sender:maker,nonce:'0x0',call_data:encodeFunctionData({abi:parseAbi(['function execute(address dest,uint256 value,bytes func)']),functionName:'execute',args:[s.controller,0n,valid.data]}),call_gas_limit:'0x10000',verification_gas_limit:'0x10000',pre_verification_gas:'0x10000',max_fee_per_gas:'0x3b9aca00',max_priority_fee_per_gas:'0x3e8',paymaster:'0x0000000000000000000000000000000000000000',paymaster_data:'0x',paymaster_verification_gas_limit:'0x0',paymaster_post_op_gas_limit:'0x0'}},authorization_context:auth(role)}));

  }
  // Provider batch preparation requires a supported RPC. No public transaction may result.
  const batchRpc=createPublicClient({transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:10000,retryCount:0})});
  const batchState=async()=>({chainId:await batchRpc.getChainId(),balance:await batchRpc.getBalance({address:maker}),nonce:await batchRpc.getTransactionCount({address:maker,blockTag:'pending'})});
  const batchBefore=await batchState();assert.equal(batchBefore.chainId,11155111);assert.equal(batchBefore.balance,0n,'batch denial probe requires an empty testnet account');
  for(const role of ['updater','emergency'])await deny(`${role} batched calls`,()=>privy.wallets().ethereum().sendCalls(wallet.id,{caip2:'eip155:11155111',sponsor:false,params:{calls:[{to:maker,data:'0x',value:'0x0'}]},authorization_context:auth(role)}),{remote:batchState});
  for(const role of ['updater','emergency']){
   await deny(`${role} cannot modify wallet`,()=>privy.wallets().update(wallet.id,{display_name:'Forbidden change',authorization_context:auth(role)}),{kind:'authorization',remote:()=>privy.wallets().get(wallet.id)});
   await deny(`${role} cannot modify policy`,()=>privy.policies().update(journal.resources.updaterPolicy.id,{name:'Forbidden change',authorization_context:auth(role)}),{kind:'authorization',remote:()=>privy.policies().get(journal.resources.updaterPolicy.id)});
   await deny(`${role} cannot change owner quorum`,()=>privy.keyQuorums().update(journal.resources.owner.id,{authorization_threshold:1,authorization_context:auth(role)}),{kind:'authorization',remote:()=>privy.keyQuorums().get(journal.resources.owner.id)});
  }
  for(const role of ['owner','updater','emergency'])await deny(`${role} key export forbidden`,()=>privy.wallets().exportPrivateKey(wallet.id,{authorization_context:auth(role)}),{kind:role==='owner'?'policy':'authorization'});
  // Already-signed bytes remain usable cryptographically after revocation; pause/version rejects them on-chain.
  const pendingArgs=[900n,28n,await read(s.controller,controllerAbi,'tuningVersion'),Number((await chain.getBlock()).timestamp)+300];
  const pendingTx=await request(s.controller,encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:pendingArgs}));pendingTx.nonce++;
  const pending=await signing('updater',pendingTx);
  const pendingAfterResume=await signing('updater',{...pendingTx,nonce:pendingTx.nonce+2});
  await call('emergency',s.controller,controllerAbi,'pause',[],'emergency pause');
  const pausedData=await read(s.router,routerAbi,'takerData',[true,1n,Number((await chain.getBlock()).timestamp)+60]);
  await assert.rejects(chain.simulateContract({account:taker,address:s.router,abi:routerAbi,functionName:'quote',args:[s.order,10n**17n,pausedData]}));check('pause blocks quote',true);
  await attempt(s,'paused fill rejected',true,10n**17n,null,'Paused');
  const additional=journal.resources.wallet.additional_signers.map(x=>({signer_id:x.signer_id,override_policy_ids:x.override_policy_ids}));
  try{
   await privy.wallets().update(wallet.id,{additional_signers:additional.filter(x=>x.signer_id!==journal.resources.updater.id),authorization_context:auth('owner')});
   await deny('revoked updater cannot sign',()=>signing('updater',valid),{kind:'authorization'});
   const before=await state(s);const failed=await broadcast(pending,'pending update after pause/revocation','reverted');
   const trace=await chain.request({method:'debug_traceTransaction',params:[failed.hash,{disableMemory:true,disableStorage:true,disableStack:true}]});
   recoveryTraces.push({hash:failed.hash,expected:'Paused()',failed:trace.failed,returnValue:trace.returnValue});
   check('pending update fails specifically at pause',trace.failed&&String(trace.returnValue).replace(/^0x/,'').startsWith(keccak256(new TextEncoder().encode('Paused()')).slice(2,10)));assert.deepEqual(await state(s),before);check('pending update leaves strategy unchanged',true);
   await deny('emergency cannot resume',()=>signing('emergency',{...valid,data:encodeFunctionData({abi:controllerAbi,functionName:'resume'})}));
   await call('owner',s.controller,controllerAbi,'resume',[],'owner validated resume');
   const resumedBefore=await state(s),stale=await broadcast(pendingAfterResume,'pending update after resume','reverted');
   const staleTrace=await chain.request({method:'debug_traceTransaction',params:[stale.hash,{disableMemory:true,disableStorage:true,disableStack:true}]});
   recoveryTraces.push({hash:stale.hash,expected:'VersionMismatch()',failed:staleTrace.failed,returnValue:staleTrace.returnValue});
   check('pre-revocation signature fails at changed version after resume',staleTrace.failed&&String(staleTrace.returnValue).replace(/^0x/,'').startsWith(keccak256(new TextEncoder().encode('VersionMismatch()')).slice(2,10)));
   assert.deepEqual(await state(s),resumedBefore);check('stale pending update leaves resumed strategy unchanged',true);
  }finally{await privy.wallets().update(wallet.id,{additional_signers:additional,authorization_context:auth('owner')});}
  await liveUpdate(s,'fresh update after revocation recovery');
  const originalOwner=await privy.keyQuorums().get(journal.resources.owner.id),recovery=await generateP256KeyPair();
  const rotated=[bundle.keys.adminA.publicKey,bundle.keys.adminB.publicKey,recovery.publicKey];
  try{
   await privy.keyQuorums().update(originalOwner.id,{public_keys:rotated,authorization_threshold:2,authorization_context:auth('owner')});
   await deny('rotated-out administrator cannot complete quorum',()=>signing('owner',valid,{authorization_private_keys:[bundle.keys.adminA.privateKey,bundle.keys.adminC.privateKey]}),{kind:'authorization'});
   await signing('owner',await request(s.controller,encodeFunctionData({abi:controllerAbi,functionName:'pause'})),{authorization_private_keys:[bundle.keys.adminA.privateKey,recovery.privateKey]});check('rotated administrator quorum authorizes',true);
  }finally{await privy.keyQuorums().update(originalOwner.id,{public_keys:originalOwner.authorization_keys.map(k=>k.public_key),authorization_threshold:2,authorization_context:auth('owner')});}
  await call('owner',s.controller,controllerAbi,'pause',[],'owner pause before recovery');
  await call('owner',aqua,aquaAbi,'dock',[s.router,s.orderHash,[W,U]],'owner docks liquidity');
  for(const token of [W,U]){const [balance,count]=await read(aqua,aquaAbi,'rawBalances',[maker,s.router,s.orderHash,token]);assert.equal(balance,0n);assert.equal(Number(count),255);}
  check('owner dock removes both strategy allocations',true);
  const recoveryBefore=await read(U,erc20,'balanceOf',[taker]);
  await call('owner',U,erc20,'transfer',[taker,1000000n],'owner treasury recovery transfer');
  check('owner recovery transfers exact USDC amount',await read(U,erc20,'balanceOf',[taker])===recoveryBefore+1000000n);
  // Explicit new fork branch demonstrates unsafe execution under the same restricted policy model.
  check('reset funded fork for unsafe branch',await chain.request({method:'evm_revert',params:[normalSnapshot]}));
  await send(maker,W,erc20,'deposit',[],4n*10n**18n,'fund upper-bound Privy maker');const upper=await setup(22,14n*10n**18n,12000n*10n**6n);
  await configureSigners(privy,bundle,resourcePath,upper.controller);
  await writeFile(`${output}/privy-final-configuration.json`,stringify({wallet:await privy.wallets().get(wallet.id),updaterPolicy:await privy.policies().get(journal.resources.updaterPolicy.id),ownerQuorum:await privy.keyQuorums().get(journal.resources.owner.id)})+'\n');
  await deny('policy retarget rejects previous controller',()=>signing('updater',valid),{target:upper});
  await liveUpdate(upper,'live upper-bound update');
  await attempt(upper,'Privy live unsafe fill',true,10n**17n,null,'ExposureOutOfBounds');
  await save();
  const operationSourceHashes={};for(const path of ['src/data/normalize.mjs','src/data/fetch.mjs','src/data/regime.mjs','planning/phase0/fixtures/sources.json','planning/phase0/fixtures/regime.graphql','src/operations/keys.mjs','src/operations/provision.mjs','src/operations/policies.mjs','src/operations/signer.mjs','scripts/proofs/f3.mjs','planning/phase0/fixtures/updater-policy.json','planning/phase0/fixtures/owner-policy.json','planning/phase0/fixtures/emergency-policy.json'])operationSourceHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(process.env.CW_PRIVY_DIAGNOSTIC==='1')throw Error('Diagnostic completed; synthetic Graph input cannot pass F3');
  return {phase4Status:'COMPLETE_MATRIX',unprovenMethods:[],batchDenialEnvironment:{chainId:11155111,operation:'zero-value self-call, sponsor:false',result:'provider policy denial; no public transaction',before:batchBefore,after:await batchState()},operationSourceHashes,operationsIdentity:'actual Privy wallet; distinct 2-of-3 owner keys controlled in one development environment',walletId:wallet.id,operationArtifacts:['privy-recovery-traces.json','privy-final-configuration.json','privy-configuration.json','privy-signatures.json','privy-operations.json','graph.json']};
 },{account});
 if(output)await writeFile(`${output}/privy-signatures.json`,stringify(signatures)+'\n');
}catch(e){console.error(JSON.stringify({result:'FAIL',status:e.status??null,errorClass:e.constructor.name,code:e.error?.code??null}));process.exitCode=1;}
