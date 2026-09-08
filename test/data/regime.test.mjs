import test from 'node:test';
import assert from 'node:assert/strict';
import {mapTurnovers, validateTuning, updateArgs, effectiveState} from '../../src/data/regime.mjs';
import {requestJson} from '../../src/data/fetch.mjs';
test('G-05 exhaustive mapping domain, independent caps and disagreement boundaries',()=>{
 for(let r=0;r<=10000;r++) {const t=mapTurnovers([r,r]);assert(t.spreadBps>=10&&t.spreadBps<=100);assert(t.intensityBps>=500&&t.intensityBps<=1000);}
 assert.deepEqual(mapTurnovers([1000,2000]),{spreadBps:28,intensityBps:900});
 assert.doesNotThrow(()=>mapTurnovers([0,5000]));assert.throws(()=>mapTurnovers([0,5001]));
 for(const values of [[1],[-1,0],[NaN,0],[1.5,0],[10001,0]])assert.throws(()=>mapTurnovers(values));
});
test('G-02 protected update allowlist, version and validity boundaries',()=>{
 const tuning={intensityBps:900,spreadBps:28};
 for(const field of ['maxWethBps','priceMicroUsdc','owner','to','data','validUntil'])assert.throws(()=>validateTuning({...tuning,[field]:0}));
 assert.deepEqual(updateArgs(tuning,2n,1000,1100),[900,28,2n,1100]);
 assert.throws(()=>updateArgs(tuning,2n,1000,1000));assert.throws(()=>updateArgs(tuning,2**64,1000,1400));
});
test('G-04 startup, accepted last good, exact TTL, expiration, pause and recovery',()=>{
 assert.equal(effectiveState(null,1000).state,'FALLBACK');
 const stored={tuning:{intensityBps:900,spreadBps:28},acceptedAt:1000,validUntil:1300};
 assert.equal(effectiveState(stored,1300).state,'FRESH');assert.deepEqual(effectiveState(stored,1301).tuning,{intensityBps:0,spreadBps:100});
 assert.equal(effectiveState(stored,1100,{paused:true}).state,'PAUSED');
 assert.equal(effectiveState({...stored,acceptedAt:1301,validUntil:1601},1301).state,'FRESH');
 assert.throws(()=>effectiveState({...stored,validUntil:9999},1000));
});
test('G-04 retries 429/5xx at 1s/2s, terminal HTTP and sanitized transport failure',async()=>{
 const waits=[];let calls=0;
 const result=await requestJson('http://local',{},{sleepImpl:async ms=>waits.push(ms),fetchImpl:async()=>++calls<3?new Response('',{status:429}):new Response('{"ok":true}')});
 assert.deepEqual(result,{ok:true});assert.equal(calls,3);assert.deepEqual(waits,[1000,2000]);
 calls=0;await assert.rejects(requestJson('http://local',{},{fetchImpl:async()=>{calls++;return new Response('',{status:403});}}),/provider HTTP 403/);assert.equal(calls,1);
 calls=0;await assert.rejects(requestJson('secret-url',{},{sleepImpl:async()=>{},fetchImpl:async()=>{calls++;throw new Error('secret-key');}}),/^Error: provider unavailable after bounded retries$/);assert.equal(calls,3);
 await assert.rejects(requestJson('http://local',{},{fetchImpl:async()=>new Response('invalid')}),/provider JSON/);
});
