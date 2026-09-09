import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,rename,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const exec=promisify(execFile);
test('Submission recording kit uses audited evidence, real receipts and portable offline links',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'cw-recording-')),out=join(temp,'kit');
 const env={...process.env};for(const name of ['GRAPH_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET','PRIVY_KEYS_FILE','PRIVY_RESOURCES_FILE'])delete env[name];
 try{
  await exec(process.execPath,['scripts/submission/prepare.mjs','--out',out],{env,timeout:30000});
  const html=await readFile(join(out,'index.html'),'utf8'),s=JSON.parse(await readFile(join(out,'demo/summary.json'),'utf8'));
  assert.equal((html.match(/class="panel"/g)||[]).length,6);assert(html.includes('RECORDED EVIDENCE'));assert(html.includes('no new transactions'));assert(html.includes(s.runAt));
  for(const text of ['200 USDC','0.5 WETH','ExposureOutOfBounds','Privy policy denial','Privy authorization denial','DO_NOT_REPEAT'])assert(html.includes(text));
  for(const a of s.attempts.slice(0,2))assert(html.includes(a.transactionHash));
  assert(!/https?:\/\//.test(html),'recording UI has no external requests');
  const m=JSON.parse(await readFile(join(out,'recording-kit.json'),'utf8'));assert.equal(m.videoRecorded,false);assert.equal(m.uploaded,false);assert.equal(m.runId,s.runId);
  for(const [file,hash] of Object.entries(m.artifactHashes))assert.equal(createHash('sha256').update(await readFile(join(out,file))).digest('hex'),hash);
  const moved=join(temp,'moved');await rename(out,moved);for(const [,target] of html.matchAll(/href="([^"]+)"/g))await access(join(moved,target));
  await assert.rejects(exec(process.execPath,['scripts/submission/prepare.mjs','--out',moved],{env}));
  assert.equal(await readFile(join(moved,'index.html'),'utf8'),html);
  await exec('python3',['scripts/proofs/audit-demo.py',join(moved,'demo'),'--out',join(temp,'presentation-audit.json')],{env});
 }finally{await rm(temp,{recursive:true,force:true});}
});
