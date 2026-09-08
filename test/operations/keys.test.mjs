import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKeys, loadKeys, validateKeys } from '../../src/operations/keys.mjs';
test('distinct valid P256 roles, exclusive persistence and owner-only permissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cw-privy-keys-'));const path=join(dir,'keys.json');
 try{
  const bundle=await createKeys(path);assert.deepEqual(await loadKeys(path),bundle);
  await assert.rejects(createKeys(path),{code:'EEXIST'});
  const duplicate=structuredClone(bundle);duplicate.keys.adminC=duplicate.keys.adminA;assert.throws(()=>validateKeys(duplicate),/distinct/);
  const mismatch=structuredClone(bundle);mismatch.keys.updater.publicKey=bundle.keys.adminA.publicKey;assert.throws(()=>validateKeys(mismatch),/mismatch/);
  await chmod(path,0o644);await assert.rejects(loadKeys(path),/owner-only/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
