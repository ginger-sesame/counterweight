#!/usr/bin/env node
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {publishReport} from '../src/demo/report.mjs';
import {prerequisites,runLive} from '../src/demo/live.mjs';
const usage='Usage: node scripts/demo.mjs replay --proof <F4-directory> --out <fresh-directory> OR live --out <fresh-directory>';
let output,created=false;
try{
 const [mode,...args]=process.argv.slice(2);
 if(mode==='--help'){console.log(usage);process.exit(0);}
 if(!['replay','live'].includes(mode)||args.length!==(mode==='replay'?4:2))throw Error('ARGUMENTS');
 const options={};for(let i=0;i<args.length;i+=2){if(!['--proof','--out'].includes(args[i])||options[args[i]]||!args[i+1]||/[\x00-\x1f\x7f]/.test(args[i+1]))throw Error('ARGUMENTS');options[args[i]]=args[i+1];}
 if(!options['--out']||(mode==='replay'?!options['--proof']:options['--proof']))throw Error('ARGUMENTS');
 output=resolve(options['--out']);if(mode==='replay'&&output.startsWith(resolve(options['--proof'])+'/'))throw Error('ARGUMENTS');await mkdir(dirname(output),{recursive:true});await mkdir(output);created=true;
 if(mode==='live'){await prerequisites();console.log('FRESH LIVE RUN — live Graph and Privy; guarded settlement on local chain 31337.');await runLive(output);console.log('Live proof completed. Auditing evidence and preparing the report.');}
 else console.log('RECORDED REPLAY — validating original evidence; no provider requests or transactions.');
 const summary=await publishReport(mode==='live'?output+'/proof':resolve(options['--proof']),output,{mode});
 console.log(`Recorded run ${summary.runAt}: ${summary.assertions} assertions, ${summary.attempts.length} settlement attempts.`);
 console.log(`Allocated WETH exposure: ${summary.start.wethPercent}% → ${summary.finish.wethPercent}%.`);
 console.log(`Report: ${JSON.stringify(output+'/report.md')}`);
}catch(error){
 const code=['PREREQUISITES','LIVE_FAILED','LIVE_INTERRUPTED'].includes(error.message)?error.message:error.message==='ARGUMENTS'?'INVALID_ARGUMENTS':error.code==='EEXIST'?'OUTPUT_EXISTS':'INVALID_PROOF';
 const message=code==='PREREQUISITES'?'Live prerequisites missing: approved Graph/Privy environment and readable key/resource files are required.':code.startsWith('LIVE_')?'Live proof did not complete. Preserve this directory and reconcile wallet state before a manual retry; no successful report was produced.':code==='INVALID_ARGUMENTS'?usage:code==='OUTPUT_EXISTS'?'Output directory already exists; choose a fresh directory.':'Evidence validation failed. No successful demo report was produced.';
 if(created){for(const file of ['report.md','summary.json','demo-manifest.json'])await rm(output+'/'+file,{force:true});await writeFile(output+'/failure.json',JSON.stringify({result:'FAIL',code,message},null,2)+'\n');}
 console.error(message);process.exitCode=1;
}
