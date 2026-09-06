// Read-only primary-source checks. Requires network; does not query live subgraphs or Privy.
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parse, buildASTSchema, visit, validate} from 'graphql';
import {encodeFunctionData, decodeFunctionData} from 'viem';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
const base=resolve(root,'planning/phase0');
const pin='2711ac91ef119f321f65b339e10a57f9aa74f9d8';
const nodePin='6838f4e3cf3607c5bc32ef705dd05aec1eb057ab';
const hashes={};
async function source(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  assert(response.ok, `${url}: ${response.status}`);
  const text=await response.text(); hashes[url]=createHash('sha256').update(text).digest('hex'); return text;
}
const [schemaText,registryText,nodeApi]=await Promise.all([
  source(`https://raw.githubusercontent.com/messari/subgraphs/${pin}/subgraphs/uniswap-v3-forks/schema.graphql`),
  source(`https://raw.githubusercontent.com/messari/subgraphs/${pin}/deployment/deployment.json`),
  source(`https://raw.githubusercontent.com/graphprotocol/graph-node/${nodePin}/graph/src/schema/api.rs`),
]);
const registry=JSON.parse(registryText);
const sources=JSON.parse(readFileSync(resolve(base,'fixtures/sources.json'),'utf8'));
for (const item of sources) {
  const protocol=item.key.replace(/-ethereum$/,'');
  const entry=registry[protocol];
  assert.equal(entry.base,'uniswap-v3-forks');
  const deployment=entry.deployments[item.key];
  assert.equal(deployment.versions.schema,item.schemaVersion);
  assert.equal(deployment.services['decentralized-network']['query-id'],item.subgraphId);
}
assert(nodeApi.includes('IdType::String | IdType::Bytes => s::ScalarType::new(String::from("String"))'), 'Re-review reference filter scalar rule');
const ast=parse(schemaText);
const definitions=new Set(ast.definitions.map(d=>d.name?.value));
const unknown=new Set();
visit(ast,{NamedType(n){if(!definitions.has(n.name.value)&&!['String','ID','Int','Float','Boolean'].includes(n.name.value)) unknown.add(n.name.value);}});
// Graph Node generates the query/filter API. This narrow modeled API follows its inspected
// reference-filter rule; source entity fields remain the actual pinned SDL, not hand-authored.
const api=`
${[...unknown].map(x=>`scalar ${x}`).join('\n')}
type Query {
  _meta: _Meta_
  dexAmmProtocols(first: Int): [DexAmmProtocol!]!
  liquidityPoolHourlySnapshots(first: Int, orderBy: CWOrderBy, orderDirection: CWDirection, where: CWFilter): [LiquidityPoolHourlySnapshot!]!
}
type _Meta_ { deployment: String!, hasIndexingErrors: Boolean!, block: _Block_! }
type _Block_ { number: Int!, hash: Bytes, timestamp: Int }
enum CWOrderBy { timestamp }
enum CWDirection { asc desc }
input CWFilter { pool: String, hour: Int }
`;
const schema=buildASTSchema(parse(schemaText+'\n'+api),{assumeValidSDL:true,assumeValid:true});
const query=readFileSync(resolve(base,'fixtures/regime.graphql'),'utf8');
assert.deepEqual(validate(schema,parse(query)).map(e=>e.message),[]);
assert(validate(schema,parse(query.replace('$pool: String!','$pool: Bytes!'))).length>0, 'Must reject wrong relationship variable type');
assert(validate(schema,parse(query.replace('hourlyVolumeUSD','nonexistentVolume'))).length>0, 'Must reject unknown entity fields');
const policy=JSON.parse(readFileSync(resolve(base,'fixtures/updater-policy.json'),'utf8'));
const abi=policy.rules[0].conditions.find(c=>c.field_source==='ethereum_calldata').abi;
const data=encodeFunctionData({abi,functionName:'setTuning',args:[900,28,1n,1788690900]});
const decoded=decodeFunctionData({abi,data});
assert.equal(decoded.functionName,'setTuning');
assert.equal(Number(decoded.args[0]),900);assert.equal(Number(decoded.args[1]),28);
const temp=mkdtempSync(resolve(tmpdir(),'cw-policy-typecheck-'));
try {
  const file=resolve(temp,'check.mts');
  const typePath=resolve(here,'node_modules/@privy-io/node/resources/policies.js');
  writeFileSync(file,`import type { PolicyCreateParams } from ${JSON.stringify(typePath)};\nconst policy: PolicyCreateParams = ${JSON.stringify(policy)};\nvoid policy;\n`);
  execFileSync(resolve(here,'node_modules/.bin/tsc'),['--noEmit','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',file],{stdio:'pipe'});
} finally {rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({result:'PASS',scope:'P-03 source compatibility; not live F2/F3',checks:['two registry identities and schema pins','GraphQL query fields against pinned source SDL','reference filter scalar from Graph Node source','wrong-type and unknown-field mutation rejection','Privy policy typecheck against SDK 0.34.0','setTuning ABI encode/decode'],sourceHashes:hashes},null,2));
