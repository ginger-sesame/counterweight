#!/usr/bin/env node
import {loadKeys} from '../../src/operations/keys.mjs';
import {privyClient,provision} from '../../src/operations/provision.mjs';
import {privyAccount,authorization,transactionRequest,inspectSigned} from '../../src/operations/signer.mjs';
import {runSettlement} from './settlement.mjs';
import {configureSigners} from '../../src/operations/policies.mjs';
import assert from 'node:assert/strict';
import {encodeFunctionData} from 'viem';
import {writeFile} from 'node:fs/promises';
try{
 const bundle=await loadKeys('.secrets/privy-development.json'),client=privyClient();
 const {wallet}=await provision(client,bundle,'.secrets/privy-resources.json');
 const signatures=[];const account=privyAccount(client,wallet,bundle,signatures);
 await runSettlement(async({setup,attempt,options,client:chain,read,state,check,maker,controllerAbi,transactions})=>{
  const s=await setup(20,10n**19n,20000n*10n**6n);
  const journal=await configureSigners(client,bundle,'.secrets/privy-resources.json',s.controller);
  const current=await state(s);
  const args=[900,28,current.version,Number((await chain.getBlock()).timestamp)+300];
  const request=transactionRequest({chainId:31337,nonce:await chain.getTransactionCount({address:maker}),to:s.controller,value:0n,data:encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args}),gas:8000000n,gasPrice:await chain.getGasPrice()});
  const signed=await client.wallets().ethereum().signTransaction(wallet.id,{params:{transaction:request},authorization_context:authorization(bundle,'updater')});
  signatures.push({role:'updater',...await inspectSigned(signed.signed_transaction,request,maker)});
  const hash=await chain.sendRawTransaction({serializedTransaction:signed.signed_transaction});const receipt=await chain.waitForTransactionReceipt({hash});
  check('Privy updater actual receipt',receipt.status==='success');transactions.push({label:'Privy updater setTuning',hash,status:receipt.status,blockNumber:receipt.blockNumber});
  const after=await state(s);check('Privy updater safety unchanged',current.safetyDigest===after.safetyDigest&&after.version===current.version+1n);
  await attempt(s,'Privy updater tuned safe fill',true,10n**17n,199440000n);
  const second=await setup(21,10n**18n,2000n*10n**6n);
  const deniedArgs=[900,28,await read(second.controller,controllerAbi,'tuningVersion'),Number((await chain.getBlock()).timestamp)+300];
  const wrongTarget={...request,nonce:await chain.getTransactionCount({address:maker}),to:second.controller,data:encodeFunctionData({abi:controllerAbi,functionName:'setTuning',args:deniedArgs})};
  await chain.simulateContract({account:maker,address:second.controller,abi:controllerAbi,functionName:'setTuning',args:deniedArgs});check('wrong target call is valid on-chain',true);
  let denied;try{await client.wallets().ethereum().signTransaction(wallet.id,{params:{transaction:wrongTarget},authorization_context:authorization(bundle,'updater')});}catch(e){denied={status:e.status,code:e.error?.code,reason:e.error?.error};}
  await writeFile(`${options.out}/privy-policy-probe.json`,JSON.stringify({walletId:wallet.id,policies:{updater:journal.resources.updaterPolicy,emergency:journal.resources.emergencyPolicy},wrongTarget:denied},null,2)+'\n');
  assert(denied,'Privy signed the forbidden target');

  await writeFile(`${options.out}/privy-signatures.json`,JSON.stringify(signatures,null,2)+'\n');
  // This commissioning spike is deliberately incomplete until the full permission matrix is implemented.
  throw Error('F3 commissioning checkpoint reached; restricted policy proof not yet implemented');
 },{account});
 const out=process.argv[process.argv.indexOf('--out')+1];if(out)await writeFile(`${out}/privy-signatures.json`,JSON.stringify(signatures,null,2)+'\n');
}catch(e){console.error(JSON.stringify({result:'FAIL',status:e.status??null,errorClass:e.constructor.name,code:e.error?.code??null}));process.exitCode=1;}
