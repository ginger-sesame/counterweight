#!/usr/bin/env node
// F1: actual canonical ERC20 settlement on the accepted local mainnet fork.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, encodeAbiParameters, getContractAddress, decodeEventLog } from 'viem';
import { foundry } from 'viem/chains';
const root=fileURLToPath(new URL('../../',import.meta.url));
const W='0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', U='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const funding='0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
const blockNumber=25917718n, blockHash='0x5dcb9480fc701b19c587e6834118725afa28ef2ba1fca9fc9d14aa9a289c059e';
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
const erc20=parseAbi(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function transfer(address,uint256) returns(bool)','function decimals() view returns(uint8)','function deposit() payable']);
export async function runSettlement(extension, operations) {
const options={out:`${root}artifacts/f1-${Date.now()}`};
let child,childExit,outputCreated=false;
let branch='funding'; const epochs=[];
const artifacts={}; const assertions=[]; const transactions=[]; const scenarios=[];
function check(name,value){assert(value,name);assertions.push({name,result:'PASS'});}
async function artifact(name){return artifacts[name]??=JSON.parse(await readFile(`${root}out/${name}.sol/${name}.json`,'utf8'));}
async function startFork(){
 const server=createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 const port=server.address().port;await new Promise(r=>server.close(r));
 child=spawn(process.env.ANVIL_BIN||'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--fork-url',process.env.ETHEREUM_RPC_URL||'https://eth-mainnet.public.blastapi.io','--fork-block-number',String(blockNumber),'--silent'],{stdio:'ignore'});
 childExit=new Promise(r=>{child.once('exit',r);child.once('error',r);});
 let failed=false;child.once('error',()=>{failed=true;});
 const rpc=`http://127.0.0.1:${port}`;
 const probe=createPublicClient({transport:http(rpc,{retryCount:0,timeout:500})});
 for(let n=0;n<100;n++){if(failed||child.exitCode!==null)throw new Error('fork node failed to start; check Anvil and archive RPC availability');try{await probe.getChainId();return rpc;}catch{await delay(300);}}
 throw new Error('fork readiness timeout');
}
try {
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i+=2){const key=args[i].slice(2);assert(args[i].startsWith('--')&&['rpc','out'].includes(key)&&args[i+1],'usage: f1.mjs [--rpc local-fork-url] [--out fresh-directory]');options[key]=args[i+1];}
 // Never mix a new proof with stale artifacts from an earlier run.
 await mkdir(dirname(options.out),{recursive:true});
 await mkdir(options.out,{recursive:false});outputCreated=true;
 const build=spawnSync(process.env.FORGE_BIN||'forge',['build','--quiet'],{cwd:root,encoding:'utf8',timeout:120000});
 assert.equal(build.status,0,'forge build failed');
 const rpc=options.rpc||await startFork();
 const url=new URL(rpc);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.protocol==='http:'&&!url.username&&!url.password&&!url.search,'F1 requires a plain loopback HTTP RPC');
 const transport=http(rpc,{retryCount:0,timeout:20000});
 const client=createPublicClient({chain:foundry,transport,pollingInterval:100});
 check('local chain ID',await client.getChainId()===31337);
 const info=await client.request({method:'anvil_nodeInfo'});
 const clientVersion=await client.request({method:'web3_clientVersion'});
 const forgeVersion=spawnSync(process.env.FORGE_BIN||'forge',['--version'],{encoding:'utf8',timeout:10000});
 assert.equal(forgeVersion.status,0,'cannot identify Foundry version');
 check('fork block provenance',Number(info.forkConfig?.forkBlockNumber)===Number(blockNumber));
 check('fresh fork state',await client.getBlockNumber()===blockNumber);
 const block=await client.getBlock({blockNumber});check('pinned Ethereum block hash',block.hash===blockHash);
 for(const [address,decimals] of [[W,18],[U,6]])check(`canonical token decimals ${address}`,await client.readContract({address,abi:erc20,functionName:'decimals'})===decimals);
 const accounts=await client.request({method:'eth_accounts'});const [localDeployer,localMaker,taker]=accounts;
 const deployer=operations?.account.address??localDeployer,maker=operations?.account.address??localMaker;
 assert(deployer&&maker&&taker);
 const wallet=account=>createWalletClient({account:operations&&account.toLowerCase()===maker.toLowerCase()?operations.account:account,chain:foundry,transport});
 async function receipt(hash,label,expected='success'){
  const r=await client.waitForTransactionReceipt({hash,timeout:30000});
  transactions.push({branch,label,hash,status:r.status,blockNumber:r.blockNumber,gasUsed:r.gasUsed,contractAddress:r.contractAddress,logs:r.logs});
  check(`${label}: receipt ${expected}`,r.status===expected);return r;
 }
 async function send(account,address,abi,functionName,args=[],value=0n,label=functionName){
  const hash=await wallet(account).writeContract({address,abi,functionName,args,value,gas:8000000n});return receipt(hash,label);
 }
 async function deploy(name,args=[]){const a=await artifact(name);const hash=await wallet(deployer).deployContract({abi:a.abi,bytecode:a.bytecode.object,args,gas:12000000n});return (await receipt(hash,`deploy ${name}`)).contractAddress;}
 async function read(address,abi,functionName,args=[]){return client.readContract({address,abi,functionName,args});}
 await client.request({method:'evm_setNextBlockTimestamp',params:[Math.floor(Date.now()/1000)]});await client.request({method:'evm_mine'});
 for(const account of [deployer,maker,taker])await client.request({method:'anvil_setBalance',params:[account,'0x3635c9adc5dea00000']});
 await send(maker,W,erc20,'deposit',[],10n**19n,'fund maker WETH');await send(taker,W,erc20,'deposit',[],10n**18n,'fund taker WETH');
 await client.request({method:'anvil_impersonateAccount',params:[funding]});
 try{
  await client.request({method:'anvil_setBalance',params:[funding,'0xde0b6b3a7640000']});
  await send(funding,U,erc20,'transfer',[maker,20000n*10n**6n],0n,'fund maker USDC');
  await send(funding,U,erc20,'transfer',[taker,5000n*10n**6n],0n,'fund taker USDC');
 }finally{await client.request({method:'anvil_stopImpersonatingAccount',params:[funding]});}
 const aqua=await deploy('Aqua');const aquaAbi=(await artifact('Aqua')).abi;
 const controllerAbi=(await artifact('EpochController')).abi,routerAbi=(await artifact('CounterweightSwapVM')).abi;
 const normalSnapshot=await client.request({method:'evm_snapshot'});
 const orderType=[{type:'tuple',components:[{name:'maker',type:'address'},{name:'traits',type:'uint256'},{name:'data',type:'bytes'}]}];
 async function setup(epoch,w,u){
  branch=epoch;
  const now=Number((await client.getBlock()).timestamp);
  const config={weth:W,usdc:U,owner:maker,epochId:BigInt(epoch),start:now,end:now+1800,targetWethBps:5000,minWethBps:3000,maxWethBps:7000,priceMicroUsdc:2000000000n,maxInputValueMicroUsdc:1000000000n};
  const nonce=await client.getTransactionCount({address:deployer});const predicted=getContractAddress({from:deployer,nonce:BigInt(nonce+1)});
  const controller=await deploy('EpochController',[config,aqua,predicted]);const router=await deploy('CounterweightSwapVM',[controller]);check('predicted router binding',router.toLowerCase()===predicted.toLowerCase());
  const order=await read(router,routerAbi,'canonicalOrder');const orderHash=await read(controller,controllerAbi,'orderHash');
  check('canonical Aqua hash',keccak256(encodeAbiParameters(orderType,[order]))===orderHash);
  for(const token of [W,U]){await send(maker,token,erc20,'approve',[aqua,token===W?20n*10n**18n:40000n*10n**6n]);await send(taker,token,erc20,'approve',[router,token===W?10n**18n:5000n*10n**6n]);}
  await send(maker,aqua,aquaAbi,'ship',[router,encodeAbiParameters(orderType,[order]),[W,U],[w,u]]);
  await send(maker,controller,controllerAbi,'resume');
  const version=await read(controller,controllerAbi,'tuningVersion');
  await send(maker,controller,controllerAbi,'setTuning',[1000,30,version,Number((await client.getBlock()).timestamp)+300]);
  const codeHashes={};for(const [name,address] of Object.entries({aqua,controller,router,WETH:W,USDC:U}))codeHashes[name]=keccak256(await client.getCode({address}));
  const result={config,controller,router,order,orderHash,codeHashes};epochs.push(result);return result;
 }
 async function state(s){
  const allocations=await read(aqua,aquaAbi,'safeBalances',[maker,s.router,s.orderHash,W,U]);
  const physical={};for(const [name,address]of Object.entries({maker,taker,router:s.router,aqua}))physical[name]=[await read(W,erc20,'balanceOf',[address]),await read(U,erc20,'balanceOf',[address])];
  const allowances={};for(const [name,account,spender] of [['maker',maker,aqua],['taker',taker,s.router]])allowances[name]=[await read(W,erc20,'allowance',[account,spender]),await read(U,erc20,'allowance',[account,spender])];
  return{allocations,physical,allowances,safetyDigest:await read(s.controller,controllerAbi,'safetyDigest'),version:await read(s.controller,controllerAbi,'tuningVersion'),paused:await read(s.controller,controllerAbi,'paused')};
 }
 async function attempt(s,label,wethIn,amount,expectedOut,errorName,preparedData){
  const deadline=Number((await client.getBlock()).timestamp)+60;
  const data=preparedData??await read(s.router,routerAbi,'takerData',[wethIn,expectedOut??1n,deadline]);
  const before=await state(s),effectiveTuning=await read(s.controller,controllerAbi,'effectiveTuning');
  const call={account:taker,address:s.router,abi:routerAbi,functionName:'swap',args:[s.order,amount,data]};
  if(!errorName){
   const quote=await client.simulateContract({...call,functionName:'quote'});check(`${label}: independent quote`,quote.result[1]===expectedOut);
  }
  const tx=await wallet(taker).writeContract({...call,gas:8000000n});
  const r=await receipt(tx,label,errorName?'reverted':'success');const after=await state(s);
  if(errorName){
   const trace=await client.request({method:'debug_traceTransaction',params:[tx,{disableMemory:true,disableStorage:true,disableStack:true}]});
   const selector=keccak256(new TextEncoder().encode(`${errorName}()`)).slice(2,10);
   check(`${label}: ${errorName} trace`,trace.failed===true&&String(trace.returnValue).replace(/^0x/,'').startsWith(selector));
   check(`${label}: reverted logs discarded`,r.logs.length===0);
   check(`${label}: atomic unchanged state`,stringify(before)===stringify(after));
   let settlementTrace;
   if(errorName==='SafeTransferFromFailed'){
    settlementTrace=await client.request({method:'debug_traceTransaction',params:[tx,{tracer:'callTracer'}]});
    const calls=[];function visit(call){calls.push(call);for(const nested of call.calls||[])visit(nested);}visit(settlementTrace);
    const inputTransfers=calls.filter(call=>call.to?.toLowerCase()===W.toLowerCase()&&call.input?.startsWith('0x23b872dd')&&!call.error);
    const failedOutput=calls.find(call=>call.to?.toLowerCase()===U.toLowerCase()&&call.input?.startsWith('0x23b872dd')&&call.error);
    check(`${label}: input transfers succeeded before output failed`,inputTransfers.length===2&&!!failedOutput&&calls.indexOf(inputTransfers[1])<calls.indexOf(failedOutput));
   }
   scenarios.push({label,branch:s.config.epochId,transaction:tx,wethIn,amountIn:amount,takerData:data,effectiveTuning,error:errorName,revertData:trace.returnValue,settlementTrace,before,after});
  }else{
   const events=r.logs.filter(log=>log.address.toLowerCase()===s.router.toLowerCase()).map(log=>decodeEventLog({abi:routerAbi,data:log.data,topics:log.topics}));
   const swapped=events.find(event=>event.eventName==='Swapped');
   check(`${label}: Swapped event`,!!swapped&&swapped.args.orderHash===s.orderHash&&swapped.args.amountIn===amount&&swapped.args.amountOut===expectedOut&&swapped.args.maker.toLowerCase()===maker.toLowerCase()&&swapped.args.taker.toLowerCase()===taker.toLowerCase());
   const i=wethIn?0:1,o=wethIn?1:0;
   check(`${label}: allocations`,after.allocations[i]===before.allocations[i]+amount&&after.allocations[o]===before.allocations[o]-expectedOut);
   check(`${label}: maker actual deltas`,after.physical.maker[i]===before.physical.maker[i]+amount&&after.physical.maker[o]===before.physical.maker[o]-expectedOut);
   check(`${label}: taker actual deltas`,after.physical.taker[i]===before.physical.taker[i]-amount&&after.physical.taker[o]===before.physical.taker[o]+expectedOut);
   check(`${label}: no router/Aqua retention`,after.physical.router.every((v,n)=>v===before.physical.router[n])&&after.physical.aqua.every((v,n)=>v===before.physical.aqua[n]));
   const [w,u]=after.allocations;check(`${label}: independent invariant`,w>=(3000n*u*10n**18n+7000n*2000000000n-1n)/(7000n*2000000000n)&&w<=7000n*u*10n**18n/(3000n*2000000000n));
   check(`${label}: safety config unchanged`,before.safetyDigest===after.safetyDigest);
   scenarios.push({label,branch:s.config.epochId,transaction:tx,wethIn,takerData:data,effectiveTuning,amountIn:amount,amountOut:expectedOut,before,after});
  }
 }
 let extra={};
 if(extension) extra=await extension({rpc,client,read,send,setup,state,attempt,check,maker,taker,W,U,erc20,controllerAbi,routerAbi,normalSnapshot,options,transactions,scenarios,aqua,aquaAbi});
 else {
 const normal=await setup(1,10n**19n,20000n*10n**6n);const safeSnapshot=await client.request({method:'evm_snapshot'});
 await attempt(normal,'safe WETH input',true,10n**17n,199400000n);
 check('reset safe branch',await client.request({method:'evm_revert',params:[safeSnapshot]}));
 await attempt(normal,'safe USDC input',false,200000000n,99700897308075772n);
 check('reset funded baseline',await client.request({method:'evm_revert',params:[normalSnapshot]}));
 const baseline=await client.request({method:'evm_snapshot'});branch=2;
 await send(maker,W,erc20,'deposit',[],4n*10n**18n,'fund upper-bound WETH');
 const upper=await setup(2,14n*10n**18n,12000n*10n**6n);
 await attempt(upper,'unsafe WETH input',true,10n**17n,null,'ExposureOutOfBounds');
 // Separate branch with lower-bound allocation; physical donations do not alter allocation.
 check('reset upper branch',await client.request({method:'evm_revert',params:[baseline]}));
 const lower=await setup(3,3n*10n**18n,14000n*10n**6n);
 await attempt(lower,'unsafe USDC input',false,200000000n,null,'ExposureOutOfBounds');
 await send(maker,U,erc20,'approve',[aqua,0n],0n,'remove output approval');
 await attempt(lower,'output transfer failure rollback',true,10n**17n,null,'SafeTransferFromFailed');
 }
 const sourceHashes={};
 for(const path of ['contracts/CounterweightSwapVM.sol','contracts/EpochController.sol','contracts/libraries/OrderCodec.sol','contracts/upstream/SwapVM.sol','contracts/upstream/SwapVM.patch','contracts/libraries/InventoryGuard.sol','contracts/libraries/QuoteMath.sol','contracts/libraries/StrategyTypes.sol','foundry.toml','package-lock.json','scripts/proofs/f1.mjs','scripts/proofs/settlement.mjs','planning/phase0/ACCOUNTING.md','planning/phase0/INTEGRATIONS.md','planning/phase0/DATA.md','planning/phase0/OPERATIONS.md'])sourceHashes[path]=createHash('sha256').update(await readFile(root+path)).digest('hex');
 const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
 const lock=JSON.parse(await readFile(root+'package-lock.json','utf8')).packages;
 const dependencyVersions={};for(const name of ['@1inch/swap-vm','@1inch/aqua','@1inch/solidity-utils','@openzeppelin/contracts','viem','@privy-io/node']){const entry=lock['node_modules/'+name];dependencyVersions[name]={version:entry.version,resolved:entry.resolved};}
 const toolVersions={node:process.version,forge:forgeVersion.stdout.trim(),anvil:clientVersion,solidity:(await artifact('CounterweightSwapVM')).metadata.compiler.version};
 const manifest={...extra,toolVersions,dependencyVersions,schemaVersion:1,gate:operations?.gate??(operations?'F3':extension?'F2':'F1'),result:'PASS',testIds:operations?.testIds??(operations?['O-01','O-02','O-03','O-04','O-05','O-06','O-07']:extension?['G-05','G-06','G-07']:['V-01','V-02','V-05','V-07']),runAt:new Date().toISOString(),gitRevision:revision.status===0?revision.stdout.trim():null,sourceHashes,
  environment:'local-mainnet-fork',chainId:31337,forkBlock:blockNumber,forkBlockHash:blockHash,maker,taker,deployer,fundingSource:funding,epochs,
  assertions:assertions.length,scenarios:scenarios.length,artifacts:['assertions.json','transactions.json','scenarios.json',...(extra.operationArtifacts??[]),...(extra.graphArtifact?[extra.graphArtifact]:[])],
  limitations:extra.limitations??['Snapshot branches are isolated scenarios, not one uninterrupted chain history.',operations?'Actual Privy signing and policies, but all development owner keys share one environment; no independent custody or public deployment claim.':extension?'Live Graph with local maker substitute; no Privy policy proof or public deployment.':'Local mainnet fork with canonical tokens; no public-network deployment or Graph/Privy proof.','V-03/V-04/V-06 coverage is recorded separately in deterministic integration and stateful suites.']};
 for(const [name,value] of Object.entries({'manifest.json':manifest,'assertions.json':assertions,'transactions.json':transactions,'scenarios.json':scenarios}))await writeFile(`${options.out}/${name}`,stringify(value)+'\n');
 process.stdout.write(stringify({result:'PASS',gate:operations?.gate??(operations?'F3':extension?'F2':'F1'),out:options.out,assertions:assertions.length,scenarios:scenarios.length})+'\n');
}catch(error){
 // Network errors may contain credential-bearing URLs. Persist only the public assertion message.
 const message=error instanceof assert.AssertionError?error.message:(error.message?.startsWith('fork ')?error.message:(error.shortMessage||error.message||'F1 execution failed').replace(/https?:[^\s]+/g,'[RPC URL redacted]'));
 const result=error.name==='DataUnavailable'||error.constructor?.name==='DataUnavailable'?'BLOCKED':'FAIL';
 const failure={result,error:message,assertions,transactions,scenarios};
 try{if(outputCreated)await writeFile(`${options.out}/failure.json`,stringify(failure)+'\n');}catch{}
 process.stderr.write(stringify({result,error:message,out:options.out})+'\n');process.exitCode=1;
}finally{
 if(child&&child.exitCode===null){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),2000);await childExit;clearTimeout(timer);}
}

}
