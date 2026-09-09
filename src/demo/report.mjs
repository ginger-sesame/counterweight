import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const exec=promisify(execFile),root=new URL('../../',import.meta.url);
export const proofFiles=['manifest.json','assertions.json','transactions.json','scenarios.json','signatures.json','operations.json','graph.json','events.json','configuration.json','checkpoint.json','restart.json','final-state.json'];
const labels=['E-01 200 USDC inventory-seeking fill','E-01 0.5 WETH unsafe fill','E-02 intervening inventory fill','E-02 old quote rejected against current inventory','E-02 settlement rollback','E-02 fallback recovery-direction fill','E-02 paused execution denied','E-02 post-recovery guarded fill'];
const descriptions=['Inventory-seeking trade','Unsafe trade blocked','Another trade changes inventory','Old quote blocked by current inventory','Failed output transfer rolls back','Trade under stale-data fallback','Trade blocked while paused','Trading resumes after recovery'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>assert.deepEqual(a,b);
const address=x=>assert(/^0x[0-9a-fA-F]{40}$/.test(x),'address identity');
const integer=x=>{assert(typeof x==='string'&&/^(0|[1-9][0-9]{0,77})$/.test(x),'unsigned quantity');return BigInt(x);};
export function units(raw,decimals){const n=integer(raw),scale=10n**BigInt(decimals),fraction=(n%scale).toString().padStart(decimals,'0').replace(/0+$/,'');return (n/scale).toString()+(fraction?'.'+fraction:'');}
export function inventory(amounts){const [w,u]=amounts.map(integer),a=w*2000000000n,b=u*10n**18n;assert(a+b>0n);const percent=a*1000000n/(a+b);return {wethWei:amounts[0],usdcUnits:amounts[1],weth:units(amounts[0],18),usdc:units(amounts[1],6),wethPercent:`${percent/10000n}.${(percent%10000n).toString().padStart(4,'0')}`,exposureNumerator:a.toString(),exposureDenominator:(a+b).toString()};}
function safeContent(value){
 if(typeof value==='string')assert(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(value),'control characters');
 else if(Array.isArray(value))value.forEach(safeContent);
 else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
  assert(!/^(privateKey|private_key|appSecret|apiKey|GRAPH_API_KEY|PRIVY_APP_SECRET|authorization_private_keys|signed_transaction|serializedTransaction|authorization)$/i.test(key),'sensitive field');safeContent(key);safeContent(item);
 }
}
async function snapshot(directory){
 const stat=await lstat(directory);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'proof directory');
 equal((await readdir(directory)).sort(),[...proofFiles].sort());
 const buffers={},data={};let total=0;
 for(const file of proofFiles){const path=join(directory,file),s=await lstat(path);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=2_000_000,'regular bounded artifact');const buffer=await readFile(path);total+=buffer.length;assert(total<=10_000_000&&buffer.length<=2_000_000);const text=buffer.toString('utf8');
  assert(!/privy_app_secret_|-----BEGIN (?:EC )?PRIVATE KEY-----/.test(text),'credential marker');
  for(const key of ['GRAPH_API_KEY','PRIVY_APP_SECRET'])if(process.env[key])assert(!text.includes(process.env[key]),'credential value');
  data[file]=JSON.parse(text);safeContent(data[file]);buffers[file]=buffer;
 }
 return {buffers,data};
}
function summarize(d,mode){
 const m=d['manifest.json'],scenarios=d['scenarios.json'],configuration=d['configuration.json'],final=d['final-state.json'],checkpoint=d['checkpoint.json'],restart=d['restart.json'];
 assert(m.schemaVersion===1&&m.gate==='F4'&&m.result==='PASS'&&m.chainId===31337&&m.environment==='local-mainnet-fork');
 assert(/^[0-9a-f]{40}$/.test(m.gitRevision)&&/^[0-9a-f-]{36}$/.test(m.runId));assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.runAt)&&new Date(m.runAt).toISOString()===m.runAt);
 equal([...m.artifacts].sort(),proofFiles.filter(x=>x!=='manifest.json').sort());equal(m.testIds,['E-01','E-02','E-03']);
 assert(m.epochs.length===1&&m.assertions>=97&&d['assertions.json'].length===m.assertions&&d['assertions.json'].every(a=>a.result==='PASS'));
 const epoch=m.epochs[0],config=epoch.config;equal(configuration.epoch,epoch);address(m.maker);address(epoch.controller);address(epoch.router);
 assert(config.epochId==='30'&&config.owner.toLowerCase()===m.maker.toLowerCase()&&config.priceMicroUsdc==='2000000000'&&config.minWethBps===3000&&config.maxWethBps===7000&&config.targetWethBps===5000&&config.maxInputValueMicroUsdc==='1000000000');
 for(const record of [configuration,final,checkpoint,restart])assert(record.runId===m.runId);
 assert(configuration.wallet.id===m.operationsIdentity.walletId&&final.wallet.id===configuration.wallet.id);assert(final.strategy.paused===false);
 assert(final.wallet.owner_id===configuration.wallet.owner_id);equal(final.wallet.policy_ids,configuration.wallet.policy_ids);
 const signers=wallet=>wallet.additional_signers.map(x=>({id:x.signer_id,policies:[...x.override_policy_ids].sort()})).sort((a,b)=>a.id.localeCompare(b.id));equal(signers(final.wallet),signers(configuration.wallet));
 equal(scenarios.map(s=>s.label),labels);assert(m.scenarios===scenarios.length);
 equal(final.strategy.allocations,scenarios.at(-1).after.allocations);assert(final.strategy.safetyDigest===checkpoint.safetyDigest);
 const attempts=scenarios.map((s,i)=>({step:i+1,title:descriptions[i],outcome:s.error?'REJECTED':'FILLED',reason:s.error??null,input:`${units(s.amountIn,s.wethIn?18:6)} ${s.wethIn?'WETH':'USDC'}`,output:s.error?null:`${units(s.amountOut,s.wethIn?6:18)} ${s.wethIn?'USDC':'WETH'}`,before:inventory(s.before.allocations),after:inventory(s.after.allocations),transactionHash:s.transaction}));
 const live=d['graph.json'].filter(x=>!x.injected);assert(live.length===3);
 const updates=live.map((pair,i)=>{
  assert(pair.controller===epoch.controller&&pair.evaluated.tuning.intensityBps>=0&&pair.evaluated.tuning.intensityBps<=1000&&pair.evaluated.tuning.spreadBps>=10&&pair.evaluated.tuning.spreadBps<=100);
  return {stage:['Initial tuning','Fresh-data recovery','Operator recovery'][i],...pair.evaluated.tuning,transactionHash:pair.transactionHash,sources:pair.evaluated.observations.map(o=>{
   assert(['uniswap-v3-ethereum','sushiswap-v3-ethereum'].includes(o.sourceKey));assert(/^[A-Za-z0-9]+$/.test(o.deploymentCid));assert(o.windowSeconds===86400&&o.windowEnd-o.windowStart===86400);
   return {venue:o.sourceKey==='uniswap-v3-ethereum'?'Uniswap V3':'SushiSwap V3',deploymentCid:o.deploymentCid,pool:o.pool,windowStart:new Date(o.windowStart*1000).toISOString(),windowEnd:new Date(o.windowEnd*1000).toISOString(),fetchedAt:new Date(o.fetchedAt*1000).toISOString(),dailyVolumeUsd:units(o.volumeUsdMicro,6),tvlUsd:units(o.tvlUsdMicro,6)};
  })};
 });
 const ops=d['operations.json'];equal(ops.map(o=>[o.role,o.method,o.kind]),[['updater','pause','policy'],['updater','setTuning','authorization']]);assert(ops[0].failure.code==='policy_violation');assert([400,401,403].includes(ops[1].failure.status));
 const permissions=ops.map(o=>{assert(/^[A-Za-z0-9_-]{1,128}$/.test(o.failure.correlationId));equal(o.before,o.after);return {action:o.method==='pause'?'Updater attempts emergency pause':'Revoked updater attempts tuning',boundary:o.kind==='policy'?'Privy policy denial':'Privy authorization denial',correlationId:o.failure.correlationId};});
 return {schemaVersion:1,mode,runId:m.runId,runAt:m.runAt,gitRevision:m.gitRevision,assertions:m.assertions,environment:'Local Ethereum fork (chain 31337)',maker:m.maker,controller:epoch.controller,orderHash:epoch.orderHash,referencePriceUsd:'2000',targetPercent:50,minPercent:30,maxPercent:70,start:attempts[0].before,finish:attempts.at(-1).after,attempts,updates,permissions,restart:{status:restart.result.status,action:restart.result.action,transactionHash:restart.result.transactionHash,nonceUnchanged:restart.nonceBefore===restart.nonceAfter,signatureCountUnchanged:restart.signatureCountBefore===restart.signatureCountAfter}};
}
export function markdown(s){
 const lines=['# Counterweight demo', '', s.mode==='live'?'**FRESH LIVE RUN — live Graph and Privy; settlement on a local Ethereum fork.**':'**RECORDED REPLAY — no new provider requests or transactions were made.**','',`Original execution: ${s.runAt}. Run: \`${s.runId}\`.`, `Proof revision: \`${s.gitRevision}\`. ${s.assertions} recorded assertions passed; eight settlement attempts.`, '', '## What happened','',`The strategy started with **${s.start.weth} WETH and ${s.start.usdc} USDC**, at **${s.start.wethPercent}% WETH exposure**. Its target is 50%, with hard bounds of 30–70%.`, '', 'A 200 USDC trade moved inventory toward the target. A subsequent 0.5 WETH attempt was blocked by the hard exposure guard. Later tests prove stale-data fallback, current-inventory checks, settlement rollback, pause/revocation recovery, and a final resumed trade.', '', 'Exposure uses allocated strategy inventory and an immutable **$2,000/WETH** demo valuation. It is not total wallet exposure or a live price oracle. Percentages below are truncated to four decimals; raw amounts and exact exposure fractions are in [summary.json](summary.json).', '', '## Trade and recovery walkthrough','', '| Step | Outcome | Requested input | Received output | WETH exposure before → after |', '| --- | --- | --- | --- | --- |'];
 for(const a of s.attempts)lines.push(`| ${a.step}. ${a.title} | ${a.outcome}${a.reason?' — '+a.reason:''} | ${a.input} | ${a.output??'None (reverted)'} | ${a.before.wethPercent}% → ${a.after.wethPercent}% |`);
 lines.push('',`Final allocated inventory: **${s.finish.weth} WETH / ${s.finish.usdc} USDC**. Every rejected attempt left token and protected strategy state unchanged; gas fees are outside this accounting.`, '', '## Live observations and bounded tuning','', 'Each update used two distinct deployments and the last completed UTC day. Daily volume divided by 24 provides an average hourly activity signal; it is not a current-hour snapshot. The signal changes only bounded spread/intensity, never the hard exposure limits.', '', '| Update | Intensity (bps) | Spread (bps) | Observation window (UTC) |','| --- | --- | --- | --- |');
 for(const u of s.updates)lines.push(`| ${u.stage} | ${u.intensityBps} | ${u.spreadBps} | ${u.sources[0].windowStart} → ${u.sources[0].windowEnd} |`);
 lines.push('', 'Source identities (each update retains its own observations in summary.json):','');
 for(const o of s.updates[0].sources)lines.push(`- ${o.venue}: \`${o.deploymentCid}\`; first fetched ${o.fetchedAt}.`);
 lines.push('', '## Who could act','', '- Owner: development 2-of-3 authorization for setup and recovery. All owner keys share one approved environment.', '- Updater: bounded tuning on the configured controller.', '- Emergency signer: pause; owner authorization restores execution.', '');
 for(const p of s.permissions)lines.push(`- ${p.action}: **${p.boundary}**, request \`${p.correlationId}\`; protected state unchanged.`);
 lines.push('', '## Restart and recovery','', `A separate read-only process found the update receipt: **${s.restart.status} / ${s.restart.action}**. Maker nonce and signature count stayed unchanged. An acceptable fetch age never authorizes reusing data for a new update; collect and validate a new pair.`, '', 'The managed fork has stopped. Its checkpoint cannot be resumed against a newly created fork.', '', '## Inspect the evidence','', '- [Original proof manifest and source/code identities](proof/manifest.json)', '- [All assertions](proof/assertions.json)', '- [Actual token balances and rollback traces](proof/scenarios.json)', '- [Transaction receipts](proof/transactions.json)', '- [Raw and normalized Graph evidence](proof/graph.json)', '- [Wallet, roles and policy configuration](proof/configuration.json)', '- [Policy and authorization denials](proof/operations.json)', '- [Public restart checkpoint](proof/checkpoint.json) and [restart result](proof/restart.json)', '- [Final wallet/policy/strategy state](proof/final-state.json)', '- [Independent arithmetic/source audit](proof-audit.json)', '- [Bundle identities and hashes](demo-manifest.json)', '', '## Limits','', 'This is a controlled demo using canonical tokens on a local fork, live provider reads/signing, static valuation and a completed-day regime signal. It does not establish public deployment, independent owner-key custody, profitability, production readiness, current prize eligibility or a completed sponsor submission.', '');
 return lines.join('\n');
}
export async function publishReport(proofDirectory,output,{mode='replay'}={}){
 assert(['live','replay'].includes(mode));
 const {data,buffers}=await snapshot(proofDirectory),summary=summarize(data,mode),staging=await mkdtemp(join(tmpdir(),'counterweight-report-'));
 try{
  for(const [file,buffer] of Object.entries(buffers))await writeFile(join(staging,file),buffer);
  const auditPath=join(staging,'audit.json');
  await exec('python3',[new URL('scripts/proofs/audit-mvp.py',root).pathname,staging,'--out',auditPath],{cwd:root,timeout:30000,maxBuffer:100000});
  const audit=JSON.parse(await readFile(auditPath,'utf8'));assert(audit.result==='PASS');
  const destination=join(output,'proof');if(resolve(proofDirectory)===resolve(destination)){for(const [file,buffer] of Object.entries(buffers))assert(hash(await readFile(join(destination,file)))===hash(buffer),'proof changed during validation');}else{await mkdir(destination);for(const [file,buffer] of Object.entries(buffers))await writeFile(join(destination,file),buffer);}
  await writeFile(join(output,'proof-audit.json'),JSON.stringify(audit,null,2)+'\n');
  await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(join(output,'report.md'),markdown(summary));
  const artifactHashes={};for(const file of ['report.md','summary.json','proof-audit.json'])artifactHashes[file]=hash(await readFile(join(output,file)));for(const [file,buffer] of Object.entries(buffers))artifactHashes['proof/'+file]=hash(buffer);
  const revision=(await exec('git',['rev-parse','HEAD'],{cwd:root})).stdout.trim();
  const reporterSourceHashes={};for(const path of ['src/demo/report.mjs','src/demo/live.mjs','scripts/demo.mjs'])reporterSourceHashes[path]=hash(await readFile(new URL(path,root)));
  await writeFile(join(output,'demo-manifest.json'),JSON.stringify({schemaVersion:1,result:'PASS',mode,createdAt:new Date().toISOString(),reporterRevision:revision,reporterSourceHashes,proofRevision:summary.gitRevision,runId:summary.runId,originalRunAt:summary.runAt,artifactHashes,limitations:['Replay validates recorded evidence; it does not perform new live verification.','Successful live mode still settles only on local chain 31337.']},null,2)+'\n');return summary;
 }finally{await rm(staging,{recursive:true,force:true});}
}
