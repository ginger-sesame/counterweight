#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {encodeFunctionData,keccak256} from 'viem';
import {loadKeys} from '../../src/operations/keys.mjs';
import {privyClient,provision} from '../../src/operations/provision.mjs';
import {privyAccount,authorization,transactionRequest,inspectSigned,broadcastOnce} from '../../src/operations/signer.mjs';
import {configureSigners,materializePolicy,verifyPolicy} from '../../src/operations/policies.mjs';
import {collectPair,DataUnavailable} from '../../src/data/fetch.mjs';
import {evaluatePair,updateArgs} from '../../src/data/regime.mjs';
import {runSettlement} from './settlement.mjs';
const root=new URL('../../',import.meta.url),json=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n';
// Independent integer transcription of ACCOUNTING.md, evaluated on current allocations.
function expectedOutput([w,u],wethIn,amount,{intensityBps,spreadBps}) {
 const P=2000000000n,Q=10n**18n,B=10000n;
 const weight=w*P*B/(w*P+u*Q);
 let skew=(weight-5000n)*BigInt(intensityBps)/B;
 skew=skew>200n?200n:skew< -200n? -200n:skew;
 return wethIn?amount*P*(B-skew)*(B-BigInt(spreadBps))/(Q*B*B):amount*Q*B*B/(P*(B-skew)*(B+BigInt(spreadBps)));
}
try {
 assert.notEqual(process.env.CW_PRIVY_DIAGNOSTIC,'1','F4 requires live sources');
 const bundle=await loadKeys(process.env.PRIVY_KEYS_FILE||'.secrets/privy-development.json'),privy=privyClient();
 const resourcePath=process.env.PRIVY_RESOURCES_FILE||'.secrets/privy-resources.json';
 const {wallet}=await provision(privy,bundle,resourcePath);
 const signatures=[],operations=[],graph=[],events=[],runId=randomUUID();
 await runSettlement(async h=>{
  const {rpc,client:chain,read,send,setup,state,attempt,check,maker,taker,W,U,erc20,controllerAbi,routerAbi,aqua,options,transactions}=h;
  const files={'signatures.json':signatures,'operations.json':operations,'graph.json':graph,'events.json':events};
  const save=async()=>{for(const [path,value]of Object.entries(files))await writeFile(`${options.out}/${path}`,json(value));};
  const event=async(label,details={})=>{events.push({runId,at:new Date().toISOString(),label,...details});await save();};
  await send(maker,W,erc20,'deposit',[],4n*10n**18n,'F4 upper inventory funding');
  const s=await setup(30,14n*10n**18n,12000n*10n**6n);
  const journal=await configureSigners(privy,bundle,resourcePath,s.controller);
  const configuration={runId,wallet:await privy.wallets().get(wallet.id),custody:bundle.custody,quorums:await Promise.all(['owner','updater','emergency'].map(r=>privy.keyQuorums().get(journal.resources[r].id))),policies:await Promise.all(['ownerPolicy','updaterPolicy','emergencyPolicy'].map(r=>privy.policies().get(journal.resources[r].id))),epoch:s};
  await writeFile(`${options.out}/configuration.json`,json(configuration));
  async function request(functionName,args=[]) {return transactionRequest({chainId:31337,nonce:await chain.getTransactionCount({address:maker,blockTag:'pending'}),to:s.controller,data:encodeFunctionData({abi:controllerAbi,functionName,args}),value:0n,gas:8000000n,gasPrice:await chain.getGasPrice()});}
  async function sign(role,transaction) {
   const result=await privy.wallets().ethereum().signTransaction(wallet.id,{params:{transaction},authorization_context:authorization(bundle,role),idempotency_key:randomUUID()});
   signatures.push({role,...await inspectSigned(result.signed_transaction,transaction,maker)});await save();return result.signed_transaction;
  }
  async function broadcast(raw,label) {
   const {hash,receipt}=await broadcastOnce(chain,raw,maker);
   check(`${label}: successful restricted receipt`,receipt.status==='success');
   transactions.push({branch:30,label,hash,status:receipt.status,blockNumber:receipt.blockNumber,logs:receipt.logs});
   await event(label,{transactionHash:hash,controller:s.controller,orderHash:s.orderHash,version:await read(s.controller,controllerAbi,'tuningVersion')});
   return hash;
  }
  async function call(role,method,args=[],label=method) {return broadcast(await sign(role,await request(method,args)),label);}
  async function deny(role,method,args=[],kind='policy') {
   const transaction=await request(method,args),before=await state(s),nonce=await chain.getTransactionCount({address:maker});let failure;
   // Prove this is a valid maker call before asking the restricted signer.
   await chain.simulateContract({account:maker,address:s.controller,abi:controllerAbi,functionName:method,args});
   try {await sign(role,transaction);} catch(e) {failure={status:e.status??null,code:e.error?.code??null,reason:e.error?.error??null,correlationId:e.headers?.get?.('x-request-id')||e.headers?.get?.('cf-ray')||null};}
   operations.push({role,method,kind,transaction,failure,before,after:await state(s)});await save();
   assert(failure,`${role} ${method}: expected provider denial`);
   if(kind==='policy')assert.equal(failure.code,'policy_violation');
   else assert([400,401,403].includes(failure.status)&&/authorization|signature|quorum|signer|owner|permission/i.test(`${failure.code} ${failure.reason}`));
   assert(failure.correlationId,'provider denial correlation ID');assert.deepEqual(await state(s),before);assert.equal(await chain.getTransactionCount({address:maker}),nonce);
   check(`${role} ${method}: actual ${kind} denial with unchanged state`,true);
  }
  const sources=JSON.parse(await readFile(new URL('planning/phase0/fixtures/sources.json',root))),query=await readFile(new URL('planning/phase0/fixtures/regime.graphql',root),'utf8');
  async function liveUpdate(label,restart=false) {
   const collection=await collectPair({sources,query,apiKey:process.env.GRAPH_API_KEY,rpcUrl:process.env.ETHEREUM_RPC_URL||undefined});
   const record={label,sources,query,collection};graph.push(record);await save();
   if(collection.result!=='COLLECTED')throw new DataUnavailable('F4 live Graph pair unavailable');
   const evaluated=evaluatePair(collection.envelopes,sources,{...collection.context,now:Math.floor(Date.now()/1000)});record.evaluated=evaluated;await save();
   const before=await state(s),config=await read(s.controller,controllerAbi,'config');
   const args=updateArgs(evaluated.tuning,before.version,Number((await chain.getBlock()).timestamp),s.config.end);
   const raw=await sign('updater',await request('setTuning',args));
   if(restart){
    const anchor=await chain.getBlock();
    const checkpoint={schemaVersion:1,runId,chainId:31337,anchor:{number:anchor.number.toString(),hash:anchor.hash},controller:s.controller,maker,codeHash:keccak256(await chain.getCode({address:s.controller})),safetyDigest:before.safetyDigest,transactionHash:keccak256(raw),observationFetchedAt:Math.min(...collection.envelopes.map(e=>e.fetchedAt)),sourceDigest:evaluated.sourceDigest};
    // Atomic public checkpoint exists before broadcast, simulating crash before receipt persistence.
    await writeFile(`${options.out}/checkpoint.tmp`,json(checkpoint));await rename(`${options.out}/checkpoint.tmp`,`${options.out}/checkpoint.json`);
   }
   const hash=await broadcast(raw,label);record.transactionHash=hash;record.controller=s.controller;record.unsignedArgs=args;
   const after=await state(s),effective=await read(s.controller,controllerAbi,'effectiveTuning');
   assert.deepEqual(await read(s.controller,controllerAbi,'config'),config);
   check(`${label}: immutable configuration and incremented version`,before.safetyDigest===after.safetyDigest&&after.version===before.version+1n);
   check(`${label}: live mapped tuning effective`,effective.available&&effective.intensityBps===evaluated.tuning.intensityBps&&effective.spreadBps===evaluated.tuning.spreadBps);
   if(restart){
    const nonce=await chain.getTransactionCount({address:maker}),signatureCount=signatures.length;
    const restartResult=await new Promise((resolve,reject)=>{
     const child=spawn(process.execPath,[new URL('./reconcile.mjs',import.meta.url).pathname,rpc,`${options.out}/checkpoint.json`],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});let stdout='';
     const timer=setTimeout(()=>child.kill('SIGKILL'),30000);child.stdout.on('data',x=>stdout+=x);child.stderr.resume();child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error('restart subprocess failed'));else try{resolve(JSON.parse(stdout));}catch{reject(Error('restart result invalid'));}});
    });
    assert.equal(restartResult.status,'CONFIRMED');assert.equal(restartResult.action,'DO_NOT_REPEAT');assert.equal(restartResult.transactionHash,hash);
    assert.equal(await chain.getTransactionCount({address:maker}),nonce);assert.equal(signatures.length,signatureCount);assert.deepEqual(await state(s),after);
    await writeFile(`${options.out}/restart.json`,json({runId,result:restartResult,nonceBefore:nonce,nonceAfter:nonce,signatureCountBefore:signatureCount,signatureCountAfter:signatures.length}));check('E-03 actual separate process reconciles without repeated operation',true);
   }
   await save();return {collection,tuning:evaluated.tuning};
  }
  const live=await liveUpdate('E-01 live restricted update',true);
  const quote=async(wethIn,amount)=>expectedOutput((await state(s)).allocations,wethIn,amount,await read(s.controller,controllerAbi,'effectiveTuning'));
  await attempt(s,'E-01 200 USDC inventory-seeking fill',false,200000000n,await quote(false,200000000n));
  await attempt(s,'E-01 0.5 WETH unsafe fill',true,5n*10n**17n,null,'ExposureOutOfBounds');
  await deny('updater','pause');
  // Quote is advisory: another real fill changes allocation before execution.
  const amount=5n*10n**16n,deadline=Number((await chain.getBlock()).timestamp)+60;
  const oldData=await read(s.router,routerAbi,'takerData',[true,1n,deadline]);
  const advisory=await chain.simulateContract({account:taker,address:s.router,abi:routerAbi,functionName:'quote',args:[s.order,amount,oldData]});
  check('E-02 old quote initially executable',advisory.result[1]===await quote(true,amount));
  await attempt(s,'E-02 intervening inventory fill',true,75n*10n**15n,await quote(true,75n*10n**15n));
  await attempt(s,'E-02 old quote rejected against current inventory',true,amount,null,'ExposureOutOfBounds',oldData);
  await send(maker,U,erc20,'approve',[aqua,0n],0n,'E-02 remove settlement output approval');
  await attempt(s,'E-02 settlement rollback',true,10n**15n,null,'SafeTransferFromFailed');
  await send(maker,U,erc20,'approve',[aqua,40000n*10n**6n],0n,'E-02 restore settlement output approval');
  const stale=structuredClone(live.collection);stale.envelopes[0].fetchedAt-=1000;const beforeStale=await state(s);
  assert.throws(()=>evaluatePair(stale.envelopes,sources,stale.context));assert.deepEqual(await state(s),beforeStale);check('E-02 stale input rejected without update',true);
  graph.push({label:'E-02 injected stale input',injected:true,collection:stale,result:'REJECTED'});
  const ttl=await read(s.controller,controllerAbi,'tuningValidUntil');await chain.request({method:'evm_setNextBlockTimestamp',params:[Number(ttl)+1]});await chain.request({method:'evm_mine'});
  const fallback=await read(s.controller,controllerAbi,'effectiveTuning');check('E-02 expired tuning falls back',!fallback.available&&fallback.intensityBps===0&&fallback.spreadBps===100);
  await attempt(s,'E-02 fallback recovery-direction fill',false,20000000n,await quote(false,20000000n));
  await liveUpdate('E-02 fresh data recovery');
  await call('emergency','pause',[],'E-02 emergency pause');
  await attempt(s,'E-02 paused execution denied',false,1000000n,null,'Paused');
  await send(maker,s.controller,controllerAbi,'resume',[],0n,'E-02 owner resume');
  const enrolled=configuration.wallet.additional_signers.map(({signer_id,override_policy_ids})=>({signer_id,override_policy_ids}));
  try {
   await privy.wallets().update(wallet.id,{additional_signers:enrolled.filter(x=>x.signer_id!==journal.resources.updater.id),authorization_context:authorization(bundle)});
   const remote=await privy.wallets().get(wallet.id);assert(!remote.additional_signers.some(x=>x.signer_id===journal.resources.updater.id));
   const args=updateArgs(live.tuning,await read(s.controller,controllerAbi,'tuningVersion'),Number((await chain.getBlock()).timestamp),s.config.end);
   await deny('updater','setTuning',args,'authorization');
  } finally {await privy.wallets().update(wallet.id,{additional_signers:enrolled,authorization_context:authorization(bundle)});}
  await liveUpdate('E-02 restored updater recovery');
  check('E-02 resume restores active execution',!(await state(s)).paused);
  await attempt(s,'E-02 post-recovery guarded fill',false,1000000n,await quote(false,1000000n));
  const finalWallet=await privy.wallets().get(wallet.id);
  const canonicalSigners=items=>items.map(({signer_id,override_policy_ids})=>({signer_id,override_policy_ids:[...override_policy_ids].sort()})).sort((a,b)=>a.signer_id.localeCompare(b.signer_id));
  assert.deepEqual(canonicalSigners(finalWallet.additional_signers),canonicalSigners(enrolled));
  assert.equal(finalWallet.owner_id,configuration.wallet.owner_id);assert.deepEqual(finalWallet.policy_ids,configuration.wallet.policy_ids);
  const finalPolicies=await Promise.all(['updater','emergency'].map(async role=>{const policy=await privy.policies().get(journal.resources[role+'Policy'].id);verifyPolicy(policy,await materializePolicy(role,journal.resources.owner.id,s.controller));return policy;}));
  check('E-02 final wallet owner and exact restricted policies restored',true);
  await writeFile(`${options.out}/final-state.json`,json({runId,strategy:await state(s),wallet:finalWallet,policies:finalPolicies}));
  await event('F4 continuous scenario complete',{controller:s.controller,orderHash:s.orderHash,epochId:30});
  const integrationSourceHashes={};for(const path of ['scripts/proofs/mvp.mjs','scripts/proofs/reconcile.mjs','src/operations/reconcile.mjs','src/operations/signer.mjs','src/operations/policies.mjs','src/operations/provision.mjs','src/data/normalize.mjs','src/data/regime.mjs','src/data/fetch.mjs','planning/phase0/fixtures/sources.json','planning/phase0/fixtures/regime.graphql','planning/phase5/README.md','planning/phase0/PROOFS.md','planning/phase0/TRACEABILITY.md','planning/phase0/fixtures/owner-policy.json','planning/phase0/fixtures/updater-policy.json','planning/phase0/fixtures/emergency-policy.json','src/operations/keys.mjs','package.json','test/mvp/mvp.test.mjs','test/operations/reconcile.test.mjs'])integrationSourceHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  return {runId,integrationSourceHashes,operationsIdentity:{walletId:wallet.id,address:maker,custody:bundle.custody},operationArtifacts:[...Object.keys(files),'configuration.json','checkpoint.json','restart.json','final-state.json'],reproductionCommand:'node --env-file=/absolute/path/to/approved.env scripts/proofs/mvp.mjs --out artifacts/<fresh-run>/mvp',limitations:['One continuous local fork epoch; no scenario resets.','Canonical mainnet tokens on a local fork; no public deployment.','Actual Privy policies with all development owner keys in one environment; independent administrator custody is not claimed.','Completed-day Graph signal is a slower activity regime, not a live execution price.','Read-only restart reconciliation requires the original fork. Unknown transaction states require manual reconciliation.']};
 },{account:privyAccount(privy,wallet,bundle,signatures),gate:'F4',testIds:['E-01','E-02','E-03']});
} catch(error) {process.stderr.write(json({result:'FAIL',error:error instanceof assert.AssertionError?error.message:'F4 setup failed; inspect approved credential and resource prerequisites',errorClass:error.constructor.name}));process.exitCode=1;}
