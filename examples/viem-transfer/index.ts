#!/usr/bin/env node
/** Helix Example: viem Transaction with Auto-Fix */
import { wrap } from '../../packages/core/src/engine/wrap.js';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { WrapOptions } from '../../packages/core/src/engine/types.js';

const PK = process.env.HELIX_TEST_PRIVATE_KEY as `0x${string}`;
if (!PK) { console.log('Set HELIX_TEST_PRIVATE_KEY'); process.exit(1); }

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
const wal = createWalletClient({ chain: baseSepolia, transport: http('https://sepolia.base.org'), account });

async function sendPayment(p: { to: `0x${string}`; value: bigint; nonce?: number }) {
  const tx: any = { to: p.to, value: p.value };
  if (p.nonce !== undefined) tx.nonce = p.nonce;
  const hash = await wal.sendTransaction(tx);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status };
}

const safePay = wrap(sendPayment, { mode: 'auto', agentId: 'viem-example', provider: { rpcUrl: 'https://sepolia.base.org' }, verbose: true, geneMapPath: ':memory:', maxRetries: 2 } as WrapOptions);

async function main() {
  const nonce = await pub.getTransactionCount({ address: account.address });
  console.log(`Real nonce: ${nonce}, sending with wrong nonce: ${nonce + 100}`);
  try {
    const r = await safePay({ to: '0x000000000000000000000000000000000000dEaD', value: parseEther('0.000001'), nonce: nonce + 100 });
    console.log('Tx:', r.hash);
    console.log('https://sepolia.basescan.org/tx/' + r.hash);
  } catch (e: any) { console.log('Error:', e.shortMessage ?? e.message); }
}
main().catch(console.error);
