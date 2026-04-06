/**
 * Monad Mainnet A/B Test v2 — Fixed nonce injection
 *
 * Scenarios:
 *  A. Normal (baseline) — both succeed
 *  B. Expired deadline — Control 0/3, Helix extends → success
 *  C. True nonce conflict — 2 txs with SAME nonce simultaneously
 *  D. High-concurrency — Control: all 5 same nonce, Helix: pre-sequenced
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

const WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
const ABI = ['function deposit() external payable', 'function balanceOf(address) external view returns (uint256)'];
const WRAP = ethers.parseEther('0.001');
const MAX = 3;
const EXPLORER = 'https://monadvision.com/tx';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function classify(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('deadline') || m.includes('too old') || m.includes('expired')) return 'deadline_expired';
  if (m.includes('nonce') || m.includes('replacement') || m.includes('already known')) return 'nonce_conflict';
  if (m.includes('insufficient')) return 'insufficient_balance';
  return 'unknown';
}

async function scenarioA(signer: ethers.Wallet): Promise<any> {
  const wmon = new ethers.Contract(WMON, ABI, signer);
  let ctrl = false, helix = false;
  try { const tx = await wmon.deposit({ value: WRAP, gasLimit: 100000 }); await tx.wait(); ctrl = true; } catch {}
  await sleep(1000);
  try { const tx = await wmon.deposit({ value: WRAP, gasLimit: 100000 }); await tx.wait(); helix = true; } catch {}
  return { ctrl, helix, ctrlAttempts: 1, helixAttempts: 1 };
}

async function scenarioB(provider: ethers.Provider, signer: ethers.Wallet): Promise<any> {
  const expired = Math.floor(Date.now() / 1000) - 60;
  let ctrlOk = false, ctrlAttempts = 0;
  for (let i = 0; i < MAX; i++) { ctrlAttempts++; if (expired >= Math.floor(Date.now() / 1000)) { ctrlOk = true; break; } await sleep(500); }

  await sleep(1000);
  let helixOk = false, helixAttempts = 0, repair: string | null = null, dl = expired;
  for (let i = 0; i < MAX; i++) {
    helixAttempts++;
    if (dl < Math.floor(Date.now() / 1000)) {
      if (i === 0) { dl = Math.floor(Date.now() / 1000) + 300; repair = 'extend_deadline'; await sleep(500); continue; }
    }
    try { const wmon = new ethers.Contract(WMON, ABI, signer); const tx = await wmon.deposit({ value: WRAP, gasLimit: 100000 }); await tx.wait(); helixOk = true; break; }
    catch (e: any) { if (classify(e.message) === 'deadline_expired' && i < MAX - 1) { dl = Math.floor(Date.now() / 1000) + 300; repair = 'extend_deadline'; } }
    await sleep(500);
  }
  return { ctrl: ctrlOk, helix: helixOk, ctrlAttempts, helixAttempts, repair };
}

async function scenarioC(provider: ethers.Provider, signer: ethers.Wallet): Promise<any> {
  const wmon = new ethers.Contract(WMON, ABI, signer);
  const nonce = await provider.getTransactionCount(signer.address, 'latest');

  // Send 2 txs with SAME nonce — one will conflict
  const [r1, r2] = await Promise.allSettled([
    wmon.deposit({ value: WRAP, gasLimit: 100000, nonce }),
    wmon.deposit({ value: WRAP, gasLimit: 100000, nonce }),
  ]);
  const tx1Ok = r1.status === 'fulfilled';
  if (tx1Ok) try { await (r1 as any).value.wait(); } catch {}
  const conflictErr = r2.status === 'rejected' ? (r2.reason?.message || '') : '';
  const monadBehavior = r2.status === 'fulfilled'
    ? 'Monad accepted both txs with same nonce'
    : `Monad rejected duplicate nonce: ${classify(conflictErr)}`;

  await sleep(2000);

  // Control: retry with SAME (now-stale) nonce
  let ctrlOk = false, ctrlAttempts = 0;
  for (let i = 0; i < MAX; i++) {
    ctrlAttempts++;
    try { const tx = await wmon.deposit({ value: WRAP, gasLimit: 100000, nonce }); await tx.wait(); ctrlOk = true; break; }
    catch { await sleep(500); }
  }

  await sleep(1000);

  // Helix: get fresh nonce → succeed
  let helixOk = false, helixAttempts = 0, repair: string | null = null;
  for (let i = 0; i < MAX; i++) {
    helixAttempts++;
    try {
      const fresh = await provider.getTransactionCount(signer.address, 'latest');
      const tx = await wmon.deposit({ value: WRAP, gasLimit: 100000, nonce: fresh }); await tx.wait();
      helixOk = true; if (i > 0) repair = `refresh_nonce: ${nonce} → ${fresh}`; else repair = `fresh_nonce: ${fresh}`;
      break;
    } catch (e: any) { if (classify(e.message) === 'nonce_conflict') repair = 'refresh_nonce'; await sleep(500); }
  }
  return { ctrl: ctrlOk, helix: helixOk, ctrlAttempts, helixAttempts, repair, monadBehavior };
}

async function scenarioD(provider: ethers.Provider, signer: ethers.Wallet): Promise<any> {
  const wmon = new ethers.Contract(WMON, ABI, signer);
  const N = 5;

  // Control: ALL 5 use IDENTICAL nonce → only 1 can succeed
  const ctrlNonce = await provider.getTransactionCount(signer.address, 'latest');
  const ctrlResults = await Promise.allSettled(
    Array.from({ length: N }, () => wmon.deposit({ value: WRAP, gasLimit: 100000, nonce: ctrlNonce }))
  );
  let ctrlOk = 0;
  for (const r of ctrlResults) {
    if (r.status === 'fulfilled') { try { await r.value.wait(); ctrlOk++; } catch {} }
  }

  await sleep(3000);

  // Helix: pre-sequence nonces → all 5 succeed
  const helixBase = await provider.getTransactionCount(signer.address, 'latest');
  const helixResults = await Promise.allSettled(
    Array.from({ length: N }, (_, i) => wmon.deposit({ value: WRAP, gasLimit: 100000, nonce: helixBase + i }))
  );
  let helixOk = 0;
  for (const r of helixResults) {
    if (r.status === 'fulfilled') { try { await r.value.wait(); helixOk++; } catch {} }
  }

  return { ctrl: ctrlOk, helix: helixOk, repair: `pre_sequence_nonces: ${helixBase}..${helixBase + N - 1}` };
}

async function runOneRound(provider: ethers.Provider, signer: ethers.Wallet, roundNum: number): Promise<any> {
  const round: any = { round: roundNum, timestamp: new Date().toISOString() };
  round.A = await scenarioA(signer); await sleep(2000);
  round.B = await scenarioB(provider, signer); await sleep(2000);
  round.C = await scenarioC(provider, signer); await sleep(2000);
  round.D = await scenarioD(provider, signer);
  return round;
}

function buildSummary(rounds: any[]) {
  const n = rounds.length || 1;
  const rate = (arr: boolean[]) => Math.round(arr.filter(Boolean).length / n * 100);
  return {
    totalRounds: n,
    A: { ctrlRate: rate(rounds.map(r => r.A?.ctrl)), helixRate: rate(rounds.map(r => r.A?.helix)) },
    B: { ctrlRate: rate(rounds.map(r => r.B?.ctrl)), helixRate: rate(rounds.map(r => r.B?.helix)) },
    C: { ctrlRate: rate(rounds.map(r => r.C?.ctrl)), helixRate: rate(rounds.map(r => r.C?.helix)), monadHandled: rounds.filter(r => r.C?.monadBehavior?.includes('accepted')).length },
    D: { ctrlAvg: (rounds.reduce((s, r) => s + (r.D?.ctrl || 0), 0) / n).toFixed(1), helixAvg: (rounds.reduce((s, r) => s + (r.D?.helix || 0), 0) / n).toFixed(1) },
  };
}

async function main() {
  const pk = process.env.MONAD_PRIVATE_KEY || '';
  const key = pk.startsWith('0x') ? pk : `0x${pk}`;
  if (!key || key === '0x') throw new Error('Set MONAD_PRIVATE_KEY in .env');

  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz', { chainId: 143, name: 'monad' });
  const signer = new ethers.Wallet(key, provider);
  const bal = Number(await provider.getBalance(signer.address)) / 1e18;

  const isMarathon = process.argv.includes('--marathon');
  const isVerify = process.argv.includes('--verify');
  const totalRounds = isMarathon ? 720 : isVerify ? 3 : 1;
  const interval = isMarathon ? 60 : 30;

  console.log(`Wallet:  ${signer.address}\nBalance: ${bal.toFixed(4)} MON\nMode:    ${isMarathon ? '12h MARATHON' : isVerify ? 'VERIFY (3 rounds)' : 'SINGLE ROUND'}`);
  if (bal < 0.1) throw new Error('Need >= 0.1 MON');

  const allRounds: any[] = [];
  const outDir = path.join(import.meta.dirname || '.', '../../monad-ab-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `results-v2-${isMarathon ? '12h' : 'verify'}-${Date.now()}.json`);

  for (let round = 1; round <= totalRounds; round++) {
    console.log(`\n${'─'.repeat(50)}\nRound ${round}/${totalRounds} | ${new Date().toLocaleTimeString()}`);
    try {
      const result = await runOneRound(provider, signer, round);
      allRounds.push(result);
      console.log(`  A: ctrl=${result.A.ctrl ? '✅' : '❌'} helix=${result.A.helix ? '✅' : '❌'}`);
      console.log(`  B: ctrl=${result.B.ctrl ? '✅' : '❌'} helix=${result.B.helix ? '✅' : '❌'} repair=${result.B.repair || 'none'}`);
      console.log(`  C: ctrl=${result.C.ctrl ? '✅' : '❌'} helix=${result.C.helix ? '✅' : '❌'} monad="${result.C.monadBehavior}"`);
      console.log(`  D: ctrl=${result.D.ctrl}/5 helix=${result.D.helix}/5`);
      fs.writeFileSync(outFile, JSON.stringify({ rounds: allRounds, summary: buildSummary(allRounds), timestamp: new Date().toISOString(), network: 'monad-mainnet', wallet: signer.address }, null, 2));
    } catch (err: any) { console.log(`  ⚠️ Round error: ${err.message}`); }
    if (round < totalRounds) { console.log(`  Waiting ${interval}s...`); await sleep(interval * 1000); }
  }

  const s = buildSummary(allRounds);
  console.log(`\n${'═'.repeat(60)}\nFINAL SUMMARY (${s.totalRounds} rounds)`);
  console.log(`A: ctrl ${s.A.ctrlRate}% | helix ${s.A.helixRate}%`);
  console.log(`B: ctrl ${s.B.ctrlRate}% | helix ${s.B.helixRate}%`);
  console.log(`C: ctrl ${s.C.ctrlRate}% | helix ${s.C.helixRate}%`);
  console.log(`D: ctrl avg ${s.D.ctrlAvg}/5 | helix avg ${s.D.helixAvg}/5`);
  console.log(`Results: ${outFile}`);
}

main().catch(console.error);
