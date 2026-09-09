import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const [debugPort='9333',site='http://127.0.0.1:8766',output='artifacts/ethonline2026-recording-final/browser-review']=process.argv.slice(2);
assert(/^\d+$/.test(debugPort)&&site.startsWith('http://127.0.0.1:'));
const pages=await (await fetch('http://127.0.0.1:'+debugPort+'/json')).json();
const page=pages.find(x=>x.type==='page'&&x.url.startsWith(site));
assert(page);const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let id=0;
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(pending.has(v.id)){const {resolve,reject}=pending.get(v.id);pending.delete(v.id);v.error?reject(Error(v.error.message)):resolve(v.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
await mkdir(output,{recursive:true});
const titles=[];
for(let i=0;i<6;i++){
 await send('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
 const state=await evaluate(`({visible:[...document.querySelectorAll('.panel')].filter(x=>!x.hidden).map(x=>x.id),title:document.querySelector('.panel:not([hidden]) h1').innerText,position:document.querySelector('#position').textContent,overflow:document.documentElement.scrollWidth>window.innerWidth})`);
 assert.deepEqual(state.visible,['chapter-'+(i+1)]);assert.equal(state.position,(i+1)+' / 6');assert.equal(state.overflow,false);titles.push(state.title);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/chapter-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
}
assert.equal(await evaluate("document.querySelector('#next').disabled"),true);
await evaluate("document.querySelector('#previous').click()");assert.equal(await evaluate("document.querySelector('#position').textContent"),'5 / 6');
await evaluate('move(-2)');await evaluate("document.querySelector('#chapter-3 details summary').click()");assert.equal(await evaluate("document.querySelector('#chapter-3 details').open"),true);
const links=await evaluate("[...document.querySelectorAll('a')].map(a=>a.href)");for(const url of links)assert.equal((await fetch(url)).status,200);
await writeFile(output+'/results.json',JSON.stringify({result:'PASS',browser:'Chromium via DevTools',viewport:[1600,900],chapters:6,titles,keyboardNavigation:true,buttonNavigation:true,receiptDisclosure:true,horizontalOverflow:false,accessibleEvidenceLinks:links.length},null,2)+'\n');
await send('Browser.close');ws.close();console.log('PASS: six browser chapters, keyboard/buttons, actual receipt disclosure and '+links.length+' evidence links');
