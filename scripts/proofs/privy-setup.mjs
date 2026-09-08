#!/usr/bin/env node
import {loadKeys} from '../../src/operations/keys.mjs';
import {privyClient,provision} from '../../src/operations/provision.mjs';
try{
 const bundle=await loadKeys('.secrets/privy-development.json');
 const result=await provision(privyClient(),bundle,'.secrets/privy-resources.json');
 console.log(JSON.stringify({result:'PASS',walletId:result.wallet.id,address:result.wallet.address,custody:bundle.custody,resources:Object.keys(result.journal.resources)}));
}catch(e){console.error(JSON.stringify({result:'FAIL',httpStatus:e.status??null,errorClass:e.constructor.name,code:e.error?.code??null,reason:e instanceof Error&&e.constructor.name==='AssertionError'?e.message:undefined}));process.exitCode=1;}
