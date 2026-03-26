/**
 * Helix Mainnet Observe Agent
 * Sends micro-transactions on Base mainnet, wrapped by Helix observe mode.
 *
 * Usage:
 *   export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/KEY"
 *   export PRIVATE_KEY="0xKEY"
 *   export RECIPIENT="0xADDRESS"
 *   npx tsx agent.ts
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { wrap } from '@helix-agent/core';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECIPIENT = process.env.RECIPIENT;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '3600000');
const AMOUNT = process.env.AMOUNT || '0.00001';

if (!PRIVATE_KEY || !RECIPIENT) { console.error('Required: PRIVATE_KEY and RECIPIENT'); process.exit(1); }

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

async function sendPayment(tx: { to: string; value: bigint }) {
  const hash = await walletClient.sendTransaction({ to: tx.to as `0x${string}`, value: tx.value });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status, gasUsed: receipt.gasUsed };
}

const safePay = wrap(sendPayment, { mode: 'observe' as any, agentId: 'mainnet-agent', verbose: true });

let attempts = 0, success = 0, failed = 0;

async function run() {
  attempts++;
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] Payment #${attempts} → ${RECIPIENT} (${AMOUNT} ETH)`);
  try {
    const r = await safePay({ to: RECIPIENT, value: parseEther(AMOUNT) });
    success++;
    console.log(`  ✓ ${r.hash} (gas: ${r.gasUsed})`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${e.message?.substring(0, 100)}`);
  }
  console.log(`  ${success}/${attempts} success, ${failed} failed`);
}

async function main() {
  const bal = await publicClient.getBalance({ address: account.address });
  console.log(`\nHelix Mainnet Observe Agent\n${'━'.repeat(30)}`);
  console.log(`Wallet:   ${account.address}`);
  console.log(`Balance:  ${formatEther(bal)} ETH`);
  console.log(`Amount:   ${AMOUNT} ETH/tx`);
  console.log(`Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`Mode:     OBSERVE (diagnose only)\n`);
  if (bal < parseEther(AMOUNT)) { console.error('Insufficient balance'); process.exit(1); }
  await run();
  setInterval(run, INTERVAL_MS);
}

main().catch(console.error);
