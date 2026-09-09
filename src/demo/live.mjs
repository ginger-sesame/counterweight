import {spawn} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function prerequisites() {
 for (const key of ['GRAPH_API_KEY','PRIVY_APP_ID','PRIVY_APP_SECRET']) {
  if (!process.env[key]) throw Error('PREREQUISITES');
 }
 for (const path of [process.env.PRIVY_KEYS_FILE || '.secrets/privy-development.json', process.env.PRIVY_RESOURCES_FILE || '.secrets/privy-resources.json']) {
  try { await access(path); } catch { throw Error('PREREQUISITES'); }
 }
 if (process.env.CW_PRIVY_DIAGNOSTIC === '1') throw Error('PREREQUISITES');
}

// Isolate the managed fork in the child's process group. Never print provider output.
export function runLive(output) {
 return new Promise((resolve,reject) => {
  const child=spawn(process.execPath,[new URL('../../scripts/proofs/mvp.mjs',import.meta.url).pathname,'--out',join(output,'proof')],{detached:true,stdio:'ignore'});
  let stopped=false,killTimer;
  const stop=()=>{
   if(stopped)return;stopped=true;
   try {process.kill(-child.pid,'SIGTERM');} catch {}
   killTimer=setTimeout(()=>{try {process.kill(-child.pid,'SIGKILL');} catch {}},3000);
  };
  const timer=setTimeout(stop,340000);
  const progress=setInterval(async()=>{
   let stage='Waiting for setup and provider configuration';
   try {
    const events=JSON.parse(await readFile(join(output,'proof/events.json'),'utf8'));
    stage=events.length?'Signed updates and guarded recovery checks are in progress':'Controller configured; collecting live observations';
   } catch {}
   console.log(stage+'.');
  },15000);
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const cleanup=()=>{clearTimeout(timer);clearTimeout(killTimer);clearInterval(progress);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);};
  child.once('error',()=>{cleanup();reject(Error('LIVE_FAILED'));});
  child.once('close',code=>{
   // The proof normally closes Anvil itself; also remove any surviving descendants.
   try {process.kill(-child.pid,'SIGKILL');} catch {}
   cleanup();code===0&&!stopped?resolve():reject(Error(stopped?'LIVE_INTERRUPTED':'LIVE_FAILED'));
  });
 });
}
