#!/usr/bin/env node
// S-08: isolated EVM simulation only. Inventory is projected; no ERC20 settlement occurs.
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, isAddress, BaseError, ContractFunctionRevertedError } from 'viem';
import { foundry } from 'viem/chains';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const options = { config: `${root}config/prototype.json`, fixtures: `${root}planning/phase0/fixtures/accounting.json` };
let node;
let exited;
function uint(value, bits = 256) {
  assert(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), 'unsigned integers must be canonical decimal strings');
  const n = BigInt(value);
  assert(n < 2n ** BigInt(bits), `uint${bits} overflow`);
  return bits <= 48 ? Number(n) : n;
}
function configInput(raw) {
  const addresses = ['weth', 'usdc', 'owner'];
  const widths = { epochId: 64, start: 40, end: 40, targetWethBps: 16, minWethBps: 16, maxWethBps: 16, priceMicroUsdc: 256, maxInputValueMicroUsdc: 256 };
  assert.deepEqual(Object.keys(raw).sort(), [...addresses, ...Object.keys(widths)].sort(), 'configuration fields must match the schema');
  const c = {};
  for (const key of addresses) { assert(isAddress(raw[key]), `invalid address: ${key}`); c[key] = raw[key]; }
  for (const [key, bits] of Object.entries(widths)) c[key] = uint(raw[key], bits);
  return c;
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
try {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    assert(['config', 'fixtures', 'out'].includes(key) && args[i].startsWith('--') && args[i + 1], 'usage: prototype.mjs [--config file] [--fixtures file] [--out file]');
    options[key] = args[i + 1];
  }
  const config = configInput(await load(options.config));
  const fixtures = await load(options.fixtures);
  assert.equal(fixtures.schemaVersion, 1);
  assert.equal(fixtures.referencePriceMicroUsdc, config.priceMicroUsdc.toString());
  assert(Array.isArray(fixtures.quotes) && fixtures.quotes.length > 0, 'missing quote assertions');
  const build = spawnSync(process.env.FORGE_BIN || 'forge', ['build', '--quiet'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(build.status, 0, `forge build failed: ${build.error?.message || build.stderr}`);
  const artifact = await load(`${root}out/StrategyPrototype.sol/StrategyPrototype.json`);
  const port = await unusedPort();
  node = spawn(process.env.ANVIL_BIN || 'anvil', ['--host', '127.0.0.1', '--port', String(port), '--timestamp', String(config.start), '--silent'], { stdio: 'ignore' });
  let nodeError;
  node.once('error', error => { nodeError = error; });
  exited = new Promise(resolve => { node.once('exit', resolve); node.once('error', resolve); });
  const transport = http(`http://127.0.0.1:${port}`, { retryCount: 0, timeout: 1000 });
  const client = createPublicClient({ chain: foundry, transport });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (nodeError || node.exitCode !== null) throw nodeError || new Error('anvil exited before readiness');
    try { assert.equal(await client.getChainId(), 31337); ready = true; break; } catch { await delay(50); }
  }
  assert(ready, 'anvil readiness timeout');
  const [account] = await client.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ account, chain: foundry, transport });
  // The constructor validates economic constraints on this isolated EVM.
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [config] });
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 10000 });
  assert.equal(receipt.status, 'success', 'configuration rejected by Solidity constructor');
  const address = receipt.contractAddress;
  const read = (functionName, args = []) => client.readContract({ address, abi: artifact.abi, functionName, args });
  const before = await read('safetyDigest');
  const normal = { available: true, intensityBps: fixtures.intensityBps, spreadBps: fixtures.spreadBps };
  const outcomes = [];
  async function run(f, tuning, regime) {
    assert(['WETH', 'USDC'].includes(f.tokenIn), 'unsupported fixture token');
    const inventory = { weth: uint(f.wethWei), usdc: uint(f.usdcUnits), physicalWeth: uint(f.wethWei), physicalUsdc: uint(f.usdcUnits) };
    const request = { tokenIn: f.tokenIn === 'WETH' ? config.weth : config.usdc, amountIn: uint(f.amountIn), exactIn: true, partialFill: false };
    let result;
    try {
      const quote = await read('quote', [inventory, request, tuning]);
      result = { result: 'PASS', quote };
    } catch (error) {
      const reverted = error instanceof BaseError ? error.walk(e => e instanceof ContractFunctionRevertedError) : undefined;
      if (!reverted?.data?.errorName) throw error;
      result = { result: reverted.data.errorName, projectedWeth: inventory.weth, projectedUsdc: inventory.usdc };
    }
    assert.equal(result.result, f.expectedResult, `${f.id}/${regime}: unexpected guard decision`);
    if (result.quote) {
      const q = result.quote;
      // Algebraically independent allowable-WETH interval (ceil lower, floor upper).
      const lowDen = BigInt(10000 - config.minWethBps) * config.priceMicroUsdc;
      const lowNum = BigInt(config.minWethBps) * q.postUsdc * 10n ** 18n;
      const lower = (lowNum + lowDen - 1n) / lowDen;
      const upper = BigInt(config.maxWethBps) * q.postUsdc * 10n ** 18n / (BigInt(10000 - config.maxWethBps) * config.priceMicroUsdc);
      assert(q.postWeth >= lower && q.postWeth <= upper, 'independent invariant failed');
      if (regime === 'normal') {
        assert.equal(q.amountOut.toString(), f.expectedOut, `${f.id}: output mismatch`);
        assert.equal(q.postWeth.toString(), f.expectedPostWethWei);
        assert.equal(q.postUsdc.toString(), f.expectedPostUsdcUnits);
        assert.equal(q.weightBps, BigInt(f.expectedWeightBps));
        assert.equal(q.skewBps, BigInt(f.expectedSkewBps));
      } else {
        assert.equal(q.effectiveTuning.intensityBps, 0);
        assert.equal(q.effectiveTuning.spreadBps, 100);
      }
    }
    outcomes.push({ id: f.id, regime, tokenIn: f.tokenIn, inventory, request, tuning, ...result });
    return result;
  }
  for (const fixture of fixtures.quotes) await run(fixture, normal, 'normal');
  for (const direction of ['WETH', 'USDC']) {
    const safe = fixtures.quotes.find(f => f.tokenIn === direction && f.id.startsWith('target-') && f.expectedResult === 'PASS');
    const unsafe = fixtures.quotes.find(f => f.tokenIn === direction && f.expectedResult === 'ExposureOutOfBounds');
    assert(safe && unsafe, `missing positive/negative ${direction} E2E fixture`);
    for (const [regime, tuning] of [
      ['missing', { available: false, intensityBps: 1000, spreadBps: 30 }],
      ['adversarial', { available: true, intensityBps: 65535, spreadBps: 0 }]
    ]) {
      const fallback = await run(safe, tuning, regime);
      assert.notEqual(fallback.quote.amountOut.toString(), safe.expectedOut, 'fallback must affect this target quote');
      await run(unsafe, tuning, regime);
    }
  }
  const after = await read('safetyDigest');
  assert.equal(after, before, 'regime changed hard safety configuration');
  const sourceHashes = {};
  for (const path of ['contracts/StrategyPrototype.sol', 'contracts/libraries/StrategyTypes.sol', 'contracts/libraries/QuoteMath.sol', 'contracts/libraries/InventoryGuard.sol', 'foundry.toml', 'package-lock.json']) {
    sourceHashes[path] = createHash('sha256').update(await readFile(root + path)).digest('hex');
  }
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const report = { schemaVersion: 1, runAt: new Date().toISOString(), gitRevision: revision.status === 0 ? revision.stdout.trim() : null, sourceHashes, nodeVersion: process.version, phase: 'P1', testIds: ['S-08'], environment: 'isolated-anvil', simulated: true, tokenSettlement: false, chainId: 31337, config, contract: address, deploymentTransaction: hash, safetyDigestBefore: before, safetyDigestAfter: after, assertions: 'PASS', outcomes };
  if (options.out) await writeFile(options.out, `${json(report)}\n`);
  process.stdout.write(`${json(report)}\n`);
} catch (error) {
  process.stderr.write(`${json({ simulated: true, assertions: 'FAIL', error: error.shortMessage || error.message })}\n`);
  process.exitCode = 1;
} finally {
  if (node && node.exitCode === null) {
    node.kill('SIGTERM');
    const timer = setTimeout(() => node.kill('SIGKILL'), 2000);
    await exited;
    clearTimeout(timer);
  }
}
