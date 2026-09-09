import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const exec=promisify(execFile);
test('D-04 public live demo runs actual F4 and packages audited evidence',{timeout:360000},async()=>{
 const output=process.env.CW_DEMO_OUT?resolve(process.env.CW_DEMO_OUT):join(await mkdtemp(join(tmpdir(),'cw-live-demo-')),'bundle');
 const result=await exec(process.execPath,['scripts/demo.mjs','live','--out',output],{timeout:355000,maxBuffer:100000});
 assert.match(result.stdout,/FRESH LIVE RUN/);
 const load=async file=>JSON.parse(await readFile(join(output,file),'utf8'));
 const summary=await load('summary.json'),manifest=await load('demo-manifest.json'),proof=await load('proof/manifest.json');
 assert.equal(summary.mode,'live');assert.equal(manifest.result,'PASS');assert.equal(summary.runId,proof.runId);assert.equal(summary.assertions,97);assert.equal(summary.attempts.length,8);
 assert.equal((await load('proof-audit.json')).result,'PASS');
 const scenarios=await load('proof/scenarios.json');
 for(let i=0;i<8;i++){
  assert.equal(summary.attempts[i].after.wethWei,scenarios[i].after.allocations[0]);
  assert.equal(summary.attempts[i].after.usdcUnits,scenarios[i].after.allocations[1]);
 }
 assert.deepEqual(summary.attempts.filter(a=>a.reason).map(a=>a.reason),['ExposureOutOfBounds','ExposureOutOfBounds','SafeTransferFromFailed','Paused']);
 assert.equal(summary.updates.length,3);assert.equal(summary.permissions.length,2);assert.equal(summary.restart.action,'DO_NOT_REPEAT');
 for(const [file,hash] of Object.entries(manifest.artifactHashes))assert.equal(createHash('sha256').update(await readFile(join(output,file))).digest('hex'),hash);
 const report=await readFile(join(output,'report.md'),'utf8');assert.match(report,/FRESH LIVE RUN/);
 for(const [,target] of report.matchAll(/\]\(([^)]+)\)/g))await readFile(join(output,target));
 console.log('Retained live demo: '+JSON.stringify(output));
});
