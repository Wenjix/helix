/**
 * Helix End-to-End Execution Test
 *
 * Deliberately triggers real errors on Base mainnet.
 * Helix repairs them in auto mode.
 * Verifies transactions actually land on-chain.
 *
 * Cost: ~$0.10 in gas fees total.
 *
 * Usage:
 *   export BASE_RPC_URL="..."
 *   export PRIVATE_KEY="0x..."
 *   export RECIPIENT="0x..."
 *   npx tsx examples/mainnet-observe/e2e-execution-test.ts
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { wrap } from '@helix-agent/core';

const RPC_URL = process.env.BASE_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RECIPIENT = process.env.RECIPIENT!;

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

interface TestResult {
  name: string;
  strategy: string;
  triggered: boolean;
  repaired: boolean;
  txHash?: string;
  repairMs?: number;
  error?: string;
}

const results: TestResult[] = [];

// ── Helper ────────────────────────────────────────────────
async function waitForTx(hash: string): Promise<boolean> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: 30_000,
    });
    return receipt.status === 'success';
  } catch {
    return false;
  }
}

// ── Test 1: refresh_nonce ─────────────────────────────────
// Deliberately use an old nonce → Helix detects nonce conflict → refreshes → tx lands
async function testRefreshNonce() {
  console.log('\n── Test 1: refresh_nonce ───────────────────\n');
  console.log('  Triggering: sending tx with stale nonce (currentNonce - 1)');

  const result: TestResult = { name: 'refresh_nonce', strategy: 'refresh_nonce', triggered: false, repaired: false };

  try {
    const currentNonce = await publicClient.getTransactionCount({ address: account.address });
    const staleNonce = Math.max(0, currentNonce - 1);

    // Raw payment function — passes nonce from tx args
    async function sendWithNonce(tx: { to: string; value: bigint; nonce?: number }) {
      return walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        value: tx.value,
        ...(tx.nonce !== undefined ? { nonce: tx.nonce } : {}),
      });
    }

    // Wrap with Helix in AUTO mode
    const safePay = wrap(sendWithNonce, {
      mode: 'auto' as any,
      platform: 'coinbase',
      verbose: true,
    });

    console.log(`  Stale nonce: ${staleNonce} (current: ${currentNonce})`);

    const hash = await safePay({ to: RECIPIENT, value: parseEther('0.000001'), nonce: staleNonce });
    result.triggered = true;
    result.repaired = true;
    result.txHash = hash as string;

    const landed = await waitForTx(hash as string);
    console.log(`  ${landed ? '✅' : '❌'} TX ${landed ? 'landed' : 'failed'}: ${hash}`);
    result.repaired = landed;
  } catch (e: any) {
    result.error = e.message?.substring(0, 100);
    console.log(`  ❌ Error: ${result.error}`);
  }

  results.push(result);
}

// ── Test 2: reduce_request ────────────────────────────────
// Send more than balance → Helix detects insufficient funds → reduces value → tx lands
async function testReduceRequest() {
  console.log('\n── Test 2: reduce_request ──────────────────\n');
  console.log('  Triggering: sending tx with value > balance');

  const result: TestResult = { name: 'reduce_request', strategy: 'reduce_request', triggered: false, repaired: false };

  try {
    const balance = await publicClient.getBalance({ address: account.address });
    // Try to send 110% of balance — guaranteed to fail
    const tooMuch = (balance * 110n) / 100n;

    async function sendTooMuch(tx: { to: string; value: bigint }) {
      return walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        value: tx.value,
      });
    }

    const safePay = wrap(sendTooMuch, {
      mode: 'auto' as any,
      platform: 'coinbase',
      verbose: true,
    });

    console.log(`  Balance: ${formatEther(balance)} ETH`);
    console.log(`  Attempting: ${formatEther(tooMuch)} ETH (110% of balance)`);

    const hash = await safePay({ to: RECIPIENT, value: tooMuch });
    result.triggered = true;

    const landed = await waitForTx(hash as string);
    console.log(`  ${landed ? '✅' : '❌'} TX ${landed ? 'landed' : 'failed'}: ${hash}`);
    result.repaired = landed;
    result.txHash = hash as string;
  } catch (e: any) {
    result.error = e.message?.substring(0, 100);
    console.log(`  ❌ Error: ${result.error}`);
  }

  results.push(result);
}

// ── Test 3: speed_up_transaction ─────────────────────────
// Send with extremely low gas → Helix detects gas too low → bumps gas → tx lands
async function testSpeedUp() {
  console.log('\n── Test 3: speed_up_transaction ────────────\n');
  console.log('  Triggering: sending tx with gas=1 (way too low)');

  const result: TestResult = { name: 'speed_up_transaction', strategy: 'speed_up_transaction', triggered: false, repaired: false };

  try {
    async function sendWithGas(tx: { to: string; value: bigint; gas?: bigint }) {
      return walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        value: tx.value,
        ...(tx.gas !== undefined ? { gas: tx.gas } : {}),
      });
    }

    const safePay = wrap(sendWithGas, {
      mode: 'auto' as any,
      platform: 'coinbase',
      verbose: true,
    });

    const hash = await safePay({ to: RECIPIENT, value: parseEther('0.000001'), gas: 1n });
    result.triggered = true;

    const landed = await waitForTx(hash as string);
    console.log(`  ${landed ? '✅' : '❌'} TX ${landed ? 'landed' : 'failed'}: ${hash}`);
    result.repaired = landed;
    result.txHash = hash as string;
  } catch (e: any) {
    result.error = e.message?.substring(0, 100);
    console.log(`  ❌ Error: ${result.error}`);
  }

  results.push(result);
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log('\nHelix End-to-End Execution Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Wallet:    ${account.address}`);
  console.log(`Recipient: ${RECIPIENT}`);
  console.log(`Mode:      AUTO (real repairs, real transactions)`);
  console.log(`Network:   Base mainnet`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:   ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.001')) {
    console.error('\n❌ Insufficient balance. Need at least 0.001 ETH.');
    process.exit(1);
  }

  await testRefreshNonce();
  await testReduceRequest();
  await testSpeedUp();

  // ── Summary ──────────────────────────────────────────
  const passed = results.filter(r => r.repaired).length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${passed}/${results.length} strategies verified end-to-end\n`);

  for (const r of results) {
    console.log(`  ${r.repaired ? '✅' : '❌'} ${r.name}`);
    if (r.txHash) console.log(`     TX: https://basescan.org/tx/${r.txHash}`);
    if (r.error) console.log(`     Error: ${r.error}`);
  }

  const finalBalance = await publicClient.getBalance({ address: account.address });
  console.log(`\nFinal balance: ${formatEther(finalBalance)} ETH`);
  console.log(`Gas spent:     ${formatEther(balance - finalBalance)} ETH`);
}

main().catch(console.error);
