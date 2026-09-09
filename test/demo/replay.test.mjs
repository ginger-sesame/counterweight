import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,cp,rename,symlink,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {units,inventory} from '../../src/demo/report.mjs';
const exec=promisify(execFile),fixture=resolve('planning/phase5/evidence/primary-clean/f4');
const env={...process.env};for(const key of ['GRAPH_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET','PRIVY_KEYS_FILE','PRIVY_RESOURCES_FILE'])delete env[key];
const run=async args=>{try {return {code:0,...await exec(process.execPath,['scripts/demo.mjs',...args],{env,timeout:45000,maxBuffer:100000})};}catch(e){return {code:e.code,stdout:e.stdout,stderr:e.stderr};}};
const load=async path=>JSON.parse(await readFile(path,'utf8'));
test('D-01 token formatting retains wei/micro-USDC and exact allocated exposure',()=>{
 assert.equal(units('1',18),'0.000000000000000001');assert.equal(units('12000000000',6),'12000');assert.equal(units('123456789',6),'123.456789');
 const x=inventory(['14000000000000000000','12000000000']);assert.equal(x.wethPercent,'70.0000');assert.equal(BigInt(x.exposureNumerator)*10n,BigInt(x.exposureDenominator)*7n);
 assert.throws(()=>units('-1',18));assert.throws(()=>inventory(['0','0']));
});
test('D-01/D-02 public offline replay produces readable exact data and portable hashed evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cw-demo-replay-')),out=join(dir,'bundle');
 try{
  const result=await run(['replay','--proof',fixture,'--out',out]);assert.equal(result.code,0,result.stderr);assert.match(result.stdout,/RECORDED REPLAY/);assert.match(result.stdout,/97 assertions, 8 settlement attempts/);
  const s=await load(join(out,'summary.json')),report=await readFile(join(out,'report.md'),'utf8'),manifest=await load(join(out,'demo-manifest.json'));
  assert.equal(s.mode,'replay');assert.equal(s.start.wethPercent,'70.0000');assert.equal(s.start.weth,'14');assert.equal(s.start.usdc,'12000');assert.equal(s.finish.wethPercent,'69.8144');assert.equal(s.attempts.length,8);assert.equal(s.updates.length,3);
  for(const phrase of ['RECORDED REPLAY','200 USDC','0.5 WETH','ExposureOutOfBounds','SafeTransferFromFailed','Privy policy denial','Privy authorization denial','CONFIRMED / DO_NOT_REPEAT','no new provider requests','$2,000/WETH','last completed UTC day','All owner keys share one approved environment']){assert(report.includes(phrase),phrase);}
  assert(!report.includes('FRESH LIVE RUN'));assert(!report.includes(fixture));assert.equal(manifest.runId,s.runId);assert.equal(s.runAt,manifest.originalRunAt);
  const original=await load(join(fixture,'scenarios.json'));for(let i=0;i<s.attempts.length;i++){assert.equal(s.attempts[i].before.wethWei,original[i].before.allocations[0]);assert.equal(s.attempts[i].after.usdcUnits,original[i].after.allocations[1]);}
  const moved=join(dir,'moved');await rename(out,moved);
  for(const target of [...report.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1])){assert(!target.includes('://')&&!target.startsWith('/'));await access(join(moved,target));}
  for(const [file,hash] of Object.entries(manifest.artifactHashes))assert.equal(createHash('sha256').update(await readFile(join(moved,file))).digest('hex'),hash);
  const reused=await run(['replay','--proof',fixture,'--out',moved]);assert.equal(reused.code,1);assert.match(reused.stderr,/already exists/);assert.equal(await readFile(join(moved,'report.md'),'utf8'),report);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('D-03 CLI rejects missing, failed, mutated, sensitive and unsafe evidence without a report',async()=>{
 const cases=[
  ['failed','manifest.json',m=>m.result='FAIL'],
  ['missing assertion','assertions.json',a=>a.pop()],
  ['wrong config','manifest.json',m=>m.epochs[0].config.maxWethBps=9000],
  ['wrong quote','scenarios.json',s=>s[0].amountOut=String(BigInt(s[0].amountOut)+1n)],
  ['wrong checkpoint','checkpoint.json',c=>c.transactionHash='0x'+'f'.repeat(64)],
  ['unsafe artifact path','manifest.json',m=>m.artifacts[0]='../../.env'],
  ['terminal injection','manifest.json',m=>m.runId='\x1b[31msecret'],
  ['Markdown injection','scenarios.json',s=>s[0].label='[click](https://example.invalid)'],
  ['private material','manifest.json',m=>m.privateKey='synthetic-secret-marker'],
  ['wrong timestamp','manifest.json',m=>m.runAt='2026-09-09'],
 ];
 for(const [label,file,mutate] of cases){const dir=await mkdtemp(join(tmpdir(),'cw-demo-negative-'));try{
  const proof=join(dir,'input'),out=join(dir,'output');await cp(fixture,proof,{recursive:true});const data=await load(join(proof,file));mutate(data);await writeFile(join(proof,file),JSON.stringify(data));
  const result=await run(['replay','--proof',proof,'--out',out]);assert.equal(result.code,1,label);assert(!result.stdout.includes('97 assertions'),label);assert.equal((await load(join(out,'failure.json'))).result,'FAIL');await assert.rejects(access(join(out,'report.md')));assert(!result.stderr.includes('synthetic-secret-marker'));
 }finally{await rm(dir,{recursive:true,force:true});}}
});
test('D-03 public CLI rejects symlinks, missing artifacts, nested output and bad arguments',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cw-demo-paths-'));
 try{
  const proof=join(dir,'input');await cp(fixture,proof,{recursive:true});await rm(join(proof,'graph.json'));assert.equal((await run(['replay','--proof',proof,'--out',join(dir,'missing')])).code,1);
  await symlink(join(fixture,'graph.json'),join(proof,'graph.json'));assert.equal((await run(['replay','--proof',proof,'--out',join(dir,'symlink')])).code,1);
  assert.equal((await run(['replay','--proof',fixture,'--out',join(fixture,'nested-test-output')])).code,1);await assert.rejects(access(join(fixture,'nested-test-output')));
  for(const args of [[],['replay'],['replay','--proof',fixture,'--proof',fixture],['replay','--unknown','x','--out',join(dir,'bad')]])assert.equal((await run(args)).code,1);
  assert.equal((await run(['--help'])).code,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('D-04 missing live credentials fail before creating any proof',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cw-demo-prerequisites-')),out=join(dir,'bundle');
 try {
  const result=await run(['live','--out',out]);assert.equal(result.code,1);
  assert.equal((await load(join(out,'failure.json'))).code,'PREREQUISITES');
  await assert.rejects(access(join(out,'proof')));await assert.rejects(access(join(out,'report.md')));
 } finally {await rm(dir,{recursive:true,force:true});}
});
