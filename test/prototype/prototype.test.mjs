import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec = promisify(execFile);
const config = JSON.parse(await readFile('config/prototype.json', 'utf8'));
const fixtures = JSON.parse(await readFile('planning/phase0/fixtures/accounting.json', 'utf8'));
async function run(args = [], env = process.env) {
  try { return { code: 0, ...await exec(process.execPath, ['scripts/proofs/prototype.mjs', ...args], { env, timeout: 45000, maxBuffer: 1024 * 1024 }) }; }
  catch (error) { assert.equal(typeof error.code, 'number', 'runner timed out or failed to spawn'); return error; }
}
async function withFile(value, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'counterweight-e2e-'));
  try { const path = join(dir, 'input.json'); await writeFile(path, JSON.stringify(value)); await fn(path, dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
test('public CLI exercises compiled Solidity, both directions, safety rejection and bounded fallback', { timeout: 45000 }, async () => {
  await withFile(config, async (_, dir) => {
    const out = join(dir, 'report.json');
    const result = await run(['--out', out]);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), report);
    assert.equal(report.simulated, true);
    assert.equal(report.tokenSettlement, false);
    assert.equal(report.assertions, 'PASS');
    assert.equal(report.outcomes.length, 24);
    assert.equal(report.safetyDigestBefore, report.safetyDigestAfter);
    for (const token of ['WETH', 'USDC']) {
      for (const regime of ['normal', 'missing', 'adversarial']) {
        const cases = report.outcomes.filter(o => o.tokenIn === token && o.regime === regime);
        assert(cases.some(o => o.result === 'PASS'));
        const rejected = cases.find(o => o.result === 'ExposureOutOfBounds');
        assert(rejected);
        assert.equal(rejected.projectedWeth, rejected.inventory.weth);
        assert.equal(rejected.projectedUsdc, rejected.inventory.usdc);
      }
    }
  });
});
test('invalid economic configuration is rejected by contract constructor', { timeout: 45000 }, async () => {
  await withFile({ ...config, minWethBps: '5000' }, async path => {
    const result = await run(['--config', path]);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stderr).assertions, 'FAIL');
    assert.match(JSON.parse(result.stderr).error, /configuration rejected by Solidity constructor|InvalidConfig/);
    assert.equal(result.stdout, '');
  });
});
test('configuration schema rejects forbidden fields and lossy or overflowing numbers', async () => {
  for (const bad of [{ ...config, maxWethBps: 7000 }, { ...config, start: '1099511627776' }, { ...config, delegatecall: true }, { ...config, priceMicroUsdc: '-1' }]) {
    await withFile(bad, async path => {
      const result = await run(['--config', path]);
      assert.equal(result.code, 1);
      assert.equal(JSON.parse(result.stderr).assertions, 'FAIL');
    });
  }
});
test('wrong independent expectation cannot produce a passing artifact', { timeout: 45000 }, async () => {
  const changed = structuredClone(fixtures);
  changed.quotes[0].expectedOut = '199400001';
  await withFile(changed, async path => {
    const result = await run(['--fixtures', path]);
    assert.equal(result.code, 1);
    assert.match(JSON.parse(result.stderr).error, /output mismatch/);
    assert.equal(result.stdout, '');
  });
});
test('missing assertions, unsupported flags and missing tools fail explicitly', async () => {
  await withFile({ ...fixtures, quotes: [] }, async path => {
    const result = await run(['--fixtures', path]);
    assert.equal(result.code, 1);
    assert.match(JSON.parse(result.stderr).error, /missing quote assertions/);
  });
  const unsupported = await run(['--rpc', 'http://127.0.0.1:8545']);
  assert.equal(unsupported.code, 1);
  assert.match(JSON.parse(unsupported.stderr).error, /usage/);
  const missing = await run([], { ...process.env, FORGE_BIN: '/nonexistent/forge' });
  assert.equal(missing.code, 1);
  assert.match(JSON.parse(missing.stderr).error, /forge build failed/);
});
