#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createPublicClient,http} from 'viem';
import {reconcileCheckpoint} from '../../src/operations/reconcile.mjs';
try {
 const [rpc,path]=process.argv.slice(2),url=new URL(rpc);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.search)throw Error('plain loopback RPC required');
 const checkpoint=JSON.parse(await readFile(path,'utf8'));
 const result=await reconcileCheckpoint(createPublicClient({transport:http(rpc,{retryCount:0,timeout:10000})}),checkpoint);
 process.stdout.write(JSON.stringify(result)+'\n');
} catch {process.stderr.write('Restart reconciliation failed; no operation attempted.\n');process.exitCode=1;}
