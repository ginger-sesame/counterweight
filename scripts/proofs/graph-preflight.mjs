#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { collectPair, DataUnavailable } from '../../src/data/fetch.mjs';
import { evaluatePair } from '../../src/data/regime.mjs';
const root=new URL('../../',import.meta.url);
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out') {console.error('usage: graph-preflight.mjs --out fresh-directory');process.exit(1);}
const out=resolve(args[1]);let created=false;
try {
 await mkdir(dirname(out),{recursive:true});await mkdir(out);created=true;
 const sources=JSON.parse(await readFile(new URL('planning/phase0/fixtures/sources.json',root)));
 const query=await readFile(new URL('planning/phase0/fixtures/regime.graphql',root),'utf8');
 const collection=await collectPair({sources,query,apiKey:process.env.GRAPH_API_KEY,rpcUrl:process.env.ETHEREUM_RPC_URL||undefined});
 // Provider responses are retained only after redaction of the configured secret.
 const save=async(name,value)=>writeFile(`${out}/${name}.json`,JSON.stringify(value,null,2).split(process.env.GRAPH_API_KEY||'__NO_KEY__').join('[REDACTED]'));
 await save('collection',collection);await writeFile(`${out}/query.graphql`,query);
 if(collection.result!=='COLLECTED') throw new DataUnavailable('two-source collection unavailable');
 const evaluated=evaluatePair(collection.envelopes,sources,collection.context);
 await save('normalized',evaluated);
 await save('manifest',{result:'PASS',scope:'G-06 preflight; not full F2',utc:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources,queryHash:createHash('sha256').update(query).digest('hex'),command:'node scripts/proofs/graph-preflight.mjs --out <fresh-directory>',artifacts:['collection.json','query.graphql','normalized.json']});
 console.log(JSON.stringify({result:'PASS',out,tuning:evaluated.tuning}));
} catch(error) {
 const result=error instanceof DataUnavailable?'BLOCKED':'FAIL';
 const reason=String(error.message).split(process.env.GRAPH_API_KEY||'__NO_KEY__').join('[REDACTED]');
 if(created) await writeFile(`${out}/failure.json`,JSON.stringify({result,reason},null,2));
 console.error(JSON.stringify({result,reason}));process.exitCode=1;
}
