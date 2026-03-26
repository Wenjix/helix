/**
 * Helix Mainnet Transaction Monitor
 * Watches Base mainnet for failed txs, feeds to Helix for diagnosis.
 *
 * Usage:
 *   export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/KEY"
 *   npx tsx monitor.ts
 */
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { writeFileSync } from 'fs';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const HELIX_URL = process.env.HELIX_URL || 'http://localhost:7842';
const POLL_MS = parseInt(process.env.POLL_INTERVAL || '15000');
const MAX_TXS = parseInt(process.env.MAX_TXS || '5');

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

let blocks = 0, txs = 0, failed = 0, diagnosed = 0, unknown = 0;
const log: any[] = [];

async function diagnose(error: string): Promise<any> {
  try {
    const r = await fetch(`${HELIX_URL}/repair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error, platform: 'coinbase' }) });
    if (r.ok) return r.json();
  } catch {} return null;
}

async function getRevert(hash: string): Promise<string> {
  try {
    const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
    if (receipt.status === 'success') return '';
    try {
      const tx = await client.getTransaction({ hash: hash as `0x${string}` });
      await client.call({ to: tx.to || undefined, data: tx.input, value: tx.value, account: tx.from, gas: tx.gas, blockNumber: receipt.blockNumber });
    } catch (e: any) { return e.message || e.shortMessage || 'EXECUTION_REVERTED'; }
    return 'EXECUTION_REVERTED';
  } catch (e: any) { return e.message || 'unknown'; }
}

async function scanBlock(num: bigint) {
  try {
    const block = await client.getBlock({ blockNumber: num, includeTransactions: true });
    blocks++;
    let checked = 0;
    for (const tx of block.transactions) {
      if (checked >= MAX_TXS || typeof tx === 'string') continue;
      try {
        const receipt = await client.getTransactionReceipt({ hash: tx.hash });
        txs++; checked++;
        if (receipt.status === 'reverted') {
          failed++;
          const reason = await getRevert(tx.hash);
          if (!reason) continue;
          const d = await diagnose(reason);
          const ts = new Date().toISOString();
          if (d?.strategy?.name) {
            diagnosed++;
            log.push({ block: Number(num), txHash: tx.hash, revert: reason.substring(0, 100), code: d.failure?.code, strategy: d.strategy?.name, ts });
            console.log(`  ✓ [${tx.hash.substring(0, 10)}] ${reason.substring(0, 60)} → ${d.strategy.name}`);
          } else { unknown++; console.log(`  ? [${tx.hash.substring(0, 10)}] ${reason.substring(0, 60)} → unknown`); }
        }
      } catch {}
    }
  } catch {}
}

function stats() {
  const rate = failed > 0 ? ((diagnosed / failed) * 100).toFixed(1) : '0';
  console.log(`\n  Blocks: ${blocks} | Txs: ${txs} | Failed: ${failed} | Diagnosed: ${diagnosed} (${rate}%) | Unknown: ${unknown}\n`);
}

async function main() {
  console.log(`\nHelix Mainnet Monitor\n${'━'.repeat(30)}`);
  console.log(`RPC:   ${RPC_URL.substring(0, 40)}...`);
  console.log(`Helix: ${HELIX_URL}`);
  console.log(`Mode:  MONITOR (read-only)\n`);
  let last = await client.getBlockNumber();
  console.log(`Starting from block ${last}\n`);
  setInterval(async () => {
    try {
      const cur = await client.getBlockNumber();
      if (cur > last) {
        for (let i = 0; i < Math.min(Number(cur - last), 3); i++) {
          const n = last + BigInt(i + 1);
          console.log(`Block ${n}:`);
          await scanBlock(n);
        }
        last += BigInt(Math.min(Number(cur - last), 3));
      }
    } catch (e: any) { console.error(`Poll: ${e.message?.substring(0, 80)}`); }
  }, POLL_MS);
  setInterval(stats, 300000);
  setInterval(() => { if (log.length) { writeFileSync('diagnosis-log.json', JSON.stringify(log, null, 2)); console.log(`  Saved ${log.length} diagnoses`); } }, 600000);
}

main().catch(console.error);
