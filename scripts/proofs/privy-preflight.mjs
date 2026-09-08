#!/usr/bin/env node
import { PrivyClient } from '@privy-io/node';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out'){console.error('usage: privy-preflight.mjs --out fresh-directory');process.exit(1);}
const out=args[1];await mkdir(dirname(out),{recursive:true});await mkdir(out);
let result;
try{
 if(!process.env.PRIVY_APP_ID||!process.env.PRIVY_APP_SECRET)throw Error('missing credentials');
 const client=new PrivyClient({appId:process.env.PRIVY_APP_ID,appSecret:process.env.PRIVY_APP_SECRET,timeout:10000,maxRetries:0});
 const page=await client.wallets().list({limit:1});
 result={result:'PASS',scope:'read-only app authentication; not F3',visibleWalletsInFirstPage:page.data.length};
}catch(error){
 // SDK errors can retain request headers; emit only a status and classification.
 result={result:'BLOCKED',scope:'read-only app authentication; not F3',httpStatus:Number.isInteger(error.status)?error.status:null,reason:error.status===401?'credentials rejected':error.status===403?'app access forbidden':'credentials missing or provider unavailable'};process.exitCode=1;
}
result.utc=new Date().toISOString();result.revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile(`${out}/manifest.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
