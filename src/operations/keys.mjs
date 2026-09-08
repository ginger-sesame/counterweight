import { generateP256KeyPair } from '@privy-io/node';
import { mkdir, open, readFile, lstat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createPrivateKey, createPublicKey } from 'node:crypto';
export function validateKeys(bundle) {
  if(bundle?.version!==1||bundle.custody!=='single-environment-development')throw Error('invalid key bundle');
  const roles=['adminA','adminB','adminC','updater','emergency'];
  const publicKeys=[];
  for(const role of roles){
    const pair=bundle.keys?.[role];
    if(!pair?.privateKey||!pair?.publicKey)throw Error('missing authorization key');
    const key=createPrivateKey({key:Buffer.from(pair.privateKey,'base64'),format:'der',type:'pkcs8'});
    if(key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('authorization key curve');
    if(createPublicKey(key).export({format:'der',type:'spki'}).toString('base64')!==pair.publicKey)throw Error('authorization key mismatch');
    publicKeys.push(pair.publicKey);
  }
  if(new Set(publicKeys).size!==roles.length)throw Error('authorization keys must be distinct');
  return bundle;
}
export async function loadKeys(path) {
  const stat=await lstat(path);
  if(!stat.isFile()||(stat.mode&0o077)!==0)throw Error('key file must be regular and owner-only');
  return validateKeys(JSON.parse(await readFile(path,'utf8')));
}
export async function createKeys(path) {
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const keys={};for(const role of ['adminA','adminB','adminC','updater','emergency'])keys[role]=await generateP256KeyPair();
  const bundle=validateKeys({version:1,custody:'single-environment-development',createdAt:new Date().toISOString(),keys});
  // Exclusive creation prevents overwriting keys that may already own remote resources.
  const file=await open(path,'wx',0o600);
  try{await file.writeFile(JSON.stringify(bundle,null,2)+'\n');await file.sync();}finally{await file.close();}
  return bundle;
}
