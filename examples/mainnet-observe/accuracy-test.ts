/**
 * Helix Accuracy Test — Real chain errors
 *
 * Usage:
 *   export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/KEY"
 *   export PRIVATE_KEY="0xKEY"
 *   export RECIPIENT="0xADDRESS"
 *   npx tsx accuracy-test.ts
 */
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.BASE_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RECIPIENT = process.env.RECIPIENT!;
const HELIX_URL = process.env.HELIX_URL || 'http://localhost:7842';

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

async function diagnose(errorMsg: string, platform = 'coinbase') {
  const res = await fetch(`${HELIX_URL}/repair`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: errorMsg, platform }),
  });
  return res.json();
}

const results: { test: string; rawError: string; helixCode: string; helixStrategy: string; expected: string; pass: boolean }[] = [];

function check(test: string, rawError: string, diagnosis: any, expectedStrategy: string) {
  const strategy = diagnosis?.strategy?.name || 'none';
  const code = diagnosis?.failure?.code || 'unknown';
  const pass = strategy === expectedStrategy;
  results.push({ test, rawError: rawError.substring(0, 80), helixCode: code, helixStrategy: strategy, expected: expectedStrategy, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${test}`);
  console.log(`     Raw:      ${rawError.substring(0, 70)}`);
  console.log(`     Helix:    ${code} → ${strategy}`);
  if (!pass) console.log(`     Expected: ${expectedStrategy}`);
  console.log();
}

async function testNonceTooLow() {
  const nonce = await publicClient.getTransactionCount({ address: account.address });
  try {
    await walletClient.sendTransaction({ to: RECIPIENT as `0x${string}`, value: parseEther('0.000001'), nonce: Math.max(0, nonce - 1) });
  } catch (e: any) {
    const msg = e.shortMessage || e.message || String(e);
    check('Nonce too low (real tx)', msg, await diagnose(msg), 'refresh_nonce');
  }
}

async function testInsufficientBalance() {
  try {
    await walletClient.sendTransaction({ to: RECIPIENT as `0x${string}`, value: parseEther('999999') });
  } catch (e: any) {
    const msg = e.shortMessage || e.message || String(e);
    check('Insufficient balance (real tx)', msg, await diagnose(msg), 'reduce_request');
  }
}

async function testGasTooLow() {
  try {
    await walletClient.sendTransaction({ to: RECIPIENT as `0x${string}`, value: parseEther('0.000001'), gas: 1n });
  } catch (e: any) {
    const msg = e.shortMessage || e.message || String(e);
    check('Gas too low (real tx)', msg, await diagnose(msg), 'speed_up_transaction');
  }
}

async function testRateLimit() {
  for (const err of ['Request rate exceeded (429)', 'Too Many Requests: rate limit exceeded', '429 Too Many Requests']) {
    check(`Rate limit: "${err}"`, err, await diagnose(err), 'backoff_retry');
  }
}

async function testRealRPCFormats() {
  const cases = [
    { msg: 'err: nonce too low: next nonce 47, tx nonce 0 (supplied gas 21000)', expected: 'refresh_nonce' },
    { msg: 'nonce too low', expected: 'refresh_nonce' },
    { msg: 'replacement transaction underpriced', expected: 'speed_up_transaction' },
    { msg: 'The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.', expected: 'reduce_request' },
  ];
  for (const { msg, expected } of cases) check('Real RPC format', msg, await diagnose(msg), expected);
}

async function main() {
  console.log('\nHelix Accuracy Test — Real Chain Errors');
  console.log('━'.repeat(40));
  console.log(`Wallet:  ${account.address}`);
  console.log(`Helix:   ${HELIX_URL}\n`);

  try { await fetch(`${HELIX_URL}/health`); } catch {
    console.error('❌ Helix not running. Start: node packages/core/dist/cli.js serve --port 7842 --mode observe');
    process.exit(1);
  }

  console.log('── Part 1: Real Chain Errors ──\n');
  await testNonceTooLow();
  await testInsufficientBalance();
  await testGasTooLow();

  console.log('── Part 2: Rate Limit ──\n');
  await testRateLimit();

  console.log('── Part 3: RPC Formats ──\n');
  await testRealRPCFormats();

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('━'.repeat(40));
  console.log(`Results: ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)\n`);

  if (passed < total) {
    console.log('Failed:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: got ${r.helixStrategy}, expected ${r.expected}`));
    console.log('\n→ Gaps to fix in platform adapters.');
  }
}

main().catch(console.error);
