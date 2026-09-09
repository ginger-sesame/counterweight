#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
const [directory,output]=process.argv.slice(2);
assert(directory&&output,'usage: audit-secrets.mjs evidence-directory report.json (approved credentials required)');
const bundle=JSON.parse(await readFile(process.env.PRIVY_KEYS_FILE||'.secrets/privy-development.json','utf8'));
const names=['GRAPH_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET'];
for(const name of names)assert(process.env[name],`${name} required for complete scan`);
const secrets=[process.env.GRAPH_API_KEY,process.env.PRIVY_APP_SECRET,...Object.values(bundle.keys).map(k=>k.privateKey),Buffer.from(`${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`).toString('base64')];
assert(secrets.every(x=>typeof x==='string'&&x.length>=16),'nonempty secret patterns required');
const patterns=[...new Set(secrets.flatMap(x=>[x,encodeURIComponent(x)]))];
const failures=[];let filesScanned=0;
async function visit(path){for(const entry of await readdir(path,{withFileTypes:true})){
 const file=join(path,entry.name);assert(!entry.isSymbolicLink(),'artifact symlink forbidden');
 if(entry.isDirectory())await visit(file);
 else if(entry.isFile()&&resolve(file)!==resolve(output)){
  const text=await readFile(file,'utf8');filesScanned++;
  if(patterns.some(secret=>text.includes(secret))||/"(?:signed_transaction|serializedTransaction|authorization_private_keys|privateKey)"\s*:/.test(text)||/-----BEGIN (?:EC )?PRIVATE KEY-----/.test(text))failures.push(relative(directory,file));
 }
}}
await visit(directory);
const report={result:failures.length?'FAIL':'PASS',filesScanned,checked:['Graph API key','Privy app secret','all supplied role private keys','Basic authentication credential','URL-encoded secret forms','raw signed transaction/private-key fields'],failures};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report)+'\n');if(failures.length)process.exitCode=1;
