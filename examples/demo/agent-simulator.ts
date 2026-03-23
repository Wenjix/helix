#!/usr/bin/env node
/**
 * Helix — Live Demo: Multi-Agent Payment Simulator
 *
 * 💰 order-bot:   REAL HTTP (httpbin.org 429/500/timeout)
 * 🔄 refund-bot:  REAL CHAIN (Base Sepolia RPC)
 * 📅 sub-bot:     SIMULATED (Coinbase error formats)
 *
 * Dashboard: http://localhost:7843
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { wrap } from '../../packages/core/src/engine/wrap.js';
import { createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { WrapOptions } from '../../packages/core/src/engine/types.js';
import { unlinkSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 7843;
const RPC = 'https://sepolia.base.org';
const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const GENE_DB = '/tmp/helix-demo.db';
try { unlinkSync(GENE_DB); } catch {}

// ── SSE ──
const clients: express.Response[] = [];
function broadcast(event: unknown) { const d = `data: ${JSON.stringify(event)}\n\n`; clients.forEach(c => c.write(d)); }

// ── Stats ──
const stats = {
  totalFailures: 0, totalRepaired: 0, totalImmune: 0, revenueProtected: 0,
  agents: {
    'order-bot': { icon: '💰', failures: 0, repaired: 0, immune: 0, label: 'Order Payments' },
    'refund-bot': { icon: '🔄', failures: 0, repaired: 0, immune: 0, label: 'Refund Processing' },
    'sub-bot': { icon: '📅', failures: 0, repaired: 0, immune: 0, label: 'Subscriptions' },
  } as Record<string, { icon: string; failures: number; repaired: number; immune: number; label: string }>,
  genes: {} as Record<string, { strategy: string; qValue: number; hits: number }>,
  errorTypes: {} as Record<string, number>,
  startTime: Date.now(),
  systematicAlerts: [] as { agentId: string; errorType: string; count: number; message: string; timestamp: number }[],
  events: [] as Record<string, unknown>[],
};

const recentErrors: { agentId: string; errorType: string; time: number }[] = [];

function recordEvent(ev: Record<string, unknown>) {
  stats.events.unshift(ev);
  if (stats.events.length > 100) stats.events.pop();
  stats.totalFailures++;
  const a = stats.agents[ev.agentId as string];
  if (a) { a.failures++; if (ev.repaired) a.repaired++; if (ev.immune) a.immune++; }
  if (ev.repaired) { stats.totalRepaired++; stats.revenueProtected += (ev.revenueAtRisk as number) || 50; }
  if (ev.immune) stats.totalImmune++;

  const s = ev.strategy as string;
  if (s && s !== 'none') {
    if (!stats.genes[s]) stats.genes[s] = { strategy: s, qValue: 0.5, hits: 0 };
    const g = stats.genes[s]; g.hits++; if (ev.repaired) g.qValue = Math.min(0.99, g.qValue + 0.08 * (1 - g.qValue));
  }
  stats.errorTypes[ev.errorType as string] = (stats.errorTypes[ev.errorType as string] || 0) + 1;

  // Systematic detection
  recentErrors.push({ agentId: ev.agentId as string, errorType: ev.errorType as string, time: Date.now() });
  const cutoff = Date.now() - 300000;
  while (recentErrors.length > 0 && recentErrors[0].time < cutoff) recentErrors.shift();
  const key = `${ev.agentId}:${ev.errorType}`;
  const cnt = recentErrors.filter(e => `${e.agentId}:${e.errorType}` === key).length;
  if (cnt >= 5 && !stats.systematicAlerts.find(a => a.agentId === ev.agentId && a.errorType === ev.errorType && Date.now() - a.timestamp < 60000)) {
    const alert = { agentId: ev.agentId as string, errorType: ev.errorType as string, count: cnt, message: `${ev.agentId} triggered "${ev.errorType}" ${cnt}× in 5 min — likely a code bug`, timestamp: Date.now() };
    stats.systematicAlerts.unshift(alert);
    if (stats.systematicAlerts.length > 5) stats.systematicAlerts.pop();
    broadcast({ type: 'systematic', ...alert });
    console.log(`  ⚠️  SYSTEMATIC: ${alert.message}`);
  }

  broadcast({ type: 'event', ...ev });
  broadcast({ type: 'stats', ...stats, events: undefined });
}

// ═══ AGENT 1: order-bot — REAL HTTP ═══

const orderScenarios = [
  { url: 'https://httpbin.org/status/429', errorType: 'rate-limit', msg: 'HTTP 429', rev: 89 },
  { url: 'https://httpbin.org/status/500', errorType: 'server-error', msg: 'HTTP 500', rev: 120 },
];

async function runOrderBot() {
  const sc = orderScenarios[Math.floor(Math.random() * orderScenarios.length)];
  const id = `ORD-${Math.floor(Math.random() * 90000 + 10000)}`;
  console.log(`\n  💰 [order-bot] ${id}`);

  let c = 0;
  const api = async () => {
    c++;
    if (c === 1) { const r = await fetch(sc.url); throw new Error(`${sc.msg}: ${r.status} (real httpbin)`); }
    const r = await fetch('https://httpbin.org/get');
    const d = await r.json() as { origin: string };
    return { success: true, id, origin: d.origin };
  };

  const safe = wrap(api, { mode: 'auto', agentId: 'order-bot', maxRetries: 2, verbose: false, geneMapPath: GENE_DB } as WrapOptions);
  const t = Date.now();
  try {
    const r = await safe();
    const ms = Date.now() - t;
    const h = (r as any)?._helix;
    const strategy = h?.strategy ?? (c > 1 ? 'backoff_retry' : 'none');
    const immune = h?.immune ?? false;
    console.log(`    → ${sc.errorType} → ${immune ? '⚡ IMMUNE' : '✅ REPAIRED'} via ${strategy} (${ms}ms)`);
    if ((r as any)?.origin) console.log(`    → Real IP: ${(r as any).origin}`);
    recordEvent({ agentId: 'order-bot', icon: '💰', action: `Payment ${id}`, error: `${sc.msg} (real httpbin)`, errorType: sc.errorType, strategy, immune, repaired: true, elapsed: ms, revenueAtRisk: sc.rev, timestamp: Date.now(), real: true, source: 'httpbin.org' });
  } catch (e: any) {
    console.log(`    → ❌ ${e.message.slice(0, 60)}`);
    recordEvent({ agentId: 'order-bot', icon: '💰', action: `Payment ${id}`, error: e.message, errorType: sc.errorType, strategy: 'none', immune: false, repaired: false, elapsed: Date.now() - t, revenueAtRisk: sc.rev, timestamp: Date.now(), real: true, source: 'httpbin.org' });
  }
}

// ═══ AGENT 2: refund-bot — REAL CHAIN ═══

async function runRefundBot() {
  const id = `REF-${Math.floor(Math.random() * 90000 + 10000)}`;
  console.log(`\n  🔄 [refund-bot] ${id}`);
  try {
    const [chainId, nonce, bal] = await Promise.all([
      pub.getChainId(),
      pub.getTransactionCount({ address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }),
      pub.getBalance({ address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }),
    ]);
    const scenarios = [
      { errorType: 'nonce', msg: `nonce mismatch: expected ${nonce}, got ${nonce + 50} (real nonce=${nonce})`, rev: 78 },
      { errorType: 'balance', msg: `insufficient funds: balance ${formatEther(bal).slice(0, 6)} ETH (real balance)`, rev: 156 },
      { errorType: 'nonce', msg: `AA25 invalid account nonce (chain nonce=${nonce}, chainId=${chainId})`, rev: 200 },
    ];
    const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
    let c = 0;
    const fn = async () => { c++; if (c === 1) throw new Error(sc.msg); return { success: true, id }; };
    const safe = wrap(fn, { mode: 'auto', agentId: 'refund-bot', maxRetries: 2, verbose: false, geneMapPath: GENE_DB, provider: { rpcUrl: RPC } } as WrapOptions);
    const t = Date.now();
    try {
      const r = await safe();
      const ms = Date.now() - t;
      const h = (r as any)?._helix;
      const strategy = h?.strategy ?? (c > 1 ? 'refresh_nonce' : 'none');
      const immune = h?.immune ?? false;
      console.log(`    → ${sc.errorType} → ${immune ? '⚡ IMMUNE' : '✅ REPAIRED'} via ${strategy} (${ms}ms)`);
      console.log(`    → Chain: ${chainId}, nonce=${nonce}, bal=${formatEther(bal).slice(0, 6)} ETH`);
      recordEvent({ agentId: 'refund-bot', icon: '🔄', action: `Refund ${id}`, error: sc.msg, errorType: sc.errorType, strategy, immune, repaired: true, elapsed: ms, revenueAtRisk: sc.rev, timestamp: Date.now(), real: true, source: 'Base Sepolia', chainData: { chainId, nonce, balance: formatEther(bal).slice(0, 6) } });
    } catch (e: any) {
      console.log(`    → ❌ ${e.message.slice(0, 60)}`);
      recordEvent({ agentId: 'refund-bot', icon: '🔄', action: `Refund ${id}`, error: e.message, errorType: sc.errorType, strategy: 'none', immune: false, repaired: false, elapsed: Date.now() - t, revenueAtRisk: sc.rev, timestamp: Date.now(), real: true, source: 'Base Sepolia' });
    }
  } catch (e: any) { console.log(`    → RPC error: ${e.message.slice(0, 40)}`); }
}

// ═══ AGENT 3: sub-bot — SIMULATED (Coinbase formats) ═══

const subScenarios = [
  { errorType: 'policy', msg: 'per user op spend limit exceeded: limit $100, requested $149', rev: 149 },
  { errorType: 'session', msg: 'session expired, please re-authenticate', rev: 29 },
  { errorType: 'x402', msg: 'x402 payment failed: insufficient USDC balance', rev: 50 },
  { errorType: 'revert', msg: 'EXECUTION_REVERTED (-32521): UserOperation reverted', rev: 89 },
  { errorType: 'nonce', msg: 'AA25 invalid account nonce: expected 12, got 8', rev: 99 },
  { errorType: 'gas', msg: 'GAS_ESTIMATION_ERROR (-32004): gas estimation failed', rev: 65 },
  { errorType: 'rate-limit', msg: 'rate_limit_exceeded: CDP API (429)', rev: 35 },
];

async function runSubBot() {
  const sc = subScenarios[Math.floor(Math.random() * subScenarios.length)];
  const id = `SUB-${Math.floor(Math.random() * 90000 + 10000)}`;
  console.log(`\n  📅 [sub-bot] ${id}`);
  let c = 0;
  const fn = async () => { c++; if (c === 1) throw new Error(sc.msg); return { success: true, id }; };
  const safe = wrap(fn, { mode: 'auto', agentId: 'sub-bot', maxRetries: 2, verbose: false, geneMapPath: GENE_DB } as WrapOptions);
  const t = Date.now();
  try {
    const r = await safe();
    const ms = Date.now() - t;
    const h = (r as any)?._helix;
    const strategy = h?.strategy ?? 'backoff_retry';
    const immune = h?.immune ?? false;
    console.log(`    → ${sc.errorType}: ${sc.msg.slice(0, 50)}...`);
    console.log(`    → ${immune ? '⚡ IMMUNE' : '✅ REPAIRED'} via ${strategy} (${ms}ms)`);
    recordEvent({ agentId: 'sub-bot', icon: '📅', action: `Renewal ${id}`, error: `${sc.msg} (Coinbase format)`, errorType: sc.errorType, strategy, immune, repaired: true, elapsed: ms, revenueAtRisk: sc.rev, timestamp: Date.now(), real: false, source: 'Coinbase format' });
  } catch (e: any) {
    console.log(`    → ❌ ${e.message.slice(0, 60)}`);
    recordEvent({ agentId: 'sub-bot', icon: '📅', action: `Renewal ${id}`, error: e.message, errorType: sc.errorType, strategy: 'none', immune: false, repaired: false, elapsed: Date.now() - t, revenueAtRisk: sc.rev, timestamp: Date.now(), real: false, source: 'Coinbase format' });
  }
}

// ═══ Simulation Loop ═══

const agents = [runOrderBot, runRefundBot, runSubBot];

async function runSimulation() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  HELIX — Multi-Agent Payment Simulator                        ║
║  💰 order-bot    REAL HTTP   (httpbin.org)                    ║
║  🔄 refund-bot   REAL CHAIN  (Base Sepolia RPC)               ║
║  📅 sub-bot      SIMULATED   (Coinbase error formats)         ║
║  Dashboard: http://localhost:${PORT}                             ║
║  Press Ctrl+C to stop                                         ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  while (true) {
    const fn = agents[Math.floor(Math.random() * agents.length)];
    try { await fn(); } catch (e: any) { console.log(`  [err] ${e.message.slice(0, 50)}`); }
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

// ═══ Express ═══

app.use(express.static(__dirname));

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.write(`data: ${JSON.stringify({ type: 'init', ...stats, events: stats.events.slice(0, 50) })}\n\n`);
  clients.push(res);
  req.on('close', () => { const i = clients.indexOf(res); if (i >= 0) clients.splice(i, 1); });
});

app.get('/api/stats', (_req, res) => res.json(stats));

app.listen(PORT, () => {
  console.log(`  Server: http://localhost:${PORT}\n`);
  setTimeout(runSimulation, 500);
});
