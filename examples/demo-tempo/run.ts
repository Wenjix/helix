#!/usr/bin/env node
import { PcecEngine, GeneMap, bus, tempoAdapter, genericAdapter } from '@helix-agent/core';
import type { SseEvent } from '@helix-agent/core';
import { tempoScenarios } from '../demo-all/scenarios-tempo.js';

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m', bgRed: '\x1b[41m' };

bus.subscribe((e: SseEvent) => {
  const ts = new Date(e.timestamp).toISOString().slice(11, 23);
  const d = e.data;
  if (e.type === 'perceive') console.log(`  ${C.dim}${ts}${C.reset} ${C.red}PERCEIVE${C.reset}  ${d.code} → ${d.category}`);
  if (e.type === 'evaluate') console.log(`  ${C.dim}${ts}${C.reset} ${C.magenta}EVALUATE${C.reset}  → ${d.winner} (score: ${d.score})`);
  if (e.type === 'commit' && d.success) console.log(`  ${C.dim}${ts}${C.reset} ${C.green}COMMIT ✓${C.reset}  ${d.strategy} (${d.totalMs}ms)`);
  if (e.type === 'immune') console.log(`  ${C.dim}${ts}${C.reset} ${C.cyan}⚡ IMMUNE${C.reset}  ${d.strategy}`);
});

async function main() {
  console.log(`\n${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  ${C.bold}HELIX${C.reset} — Tempo / MPP Demo (13 Scenarios)                      ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}\n`);

  const geneMap = new GeneMap(':memory:');
  const engine = new PcecEngine(geneMap, 'tempo-demo');
  engine.registerAdapter(tempoAdapter);
  engine.registerAdapter(genericAdapter);

  for (const s of tempoScenarios) {
    const label = s.tag === 'real' ? `${C.bgRed}${C.white} REAL ${C.reset}` : `${C.dim}(${s.tag})${C.reset}`;
    console.log(`${C.bold}▸ ${s.id}.  ${s.name}${C.reset} ${label}`);
    const err = new Error(s.errorMessage);
    (err as unknown as Record<string, unknown>).code = s.errorCode;
    const r = await engine.repair(err);
    console.log(`  → ${r.success ? C.green + '✓' : C.red + '✗'}${C.reset} ${r.totalMs}ms ($${r.revenueProtected})\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`${C.cyan}━━━ ⚡ Immunity ━━━${C.reset}\n`);
  for (const s of [tempoScenarios[0], tempoScenarios[1], tempoScenarios[2], tempoScenarios[12]]) {
    console.log(`${C.bold}▸ ${s.id}.  ${s.name}${C.reset} ${C.cyan}[IMMUNITY]${C.reset}`);
    const err = new Error(s.errorMessage);
    (err as unknown as Record<string, unknown>).code = s.errorCode;
    const r = await engine.repair(err);
    console.log(`  → ${r.immune ? C.cyan + '⚡ IMMUNE' : C.green + '✓'}${C.reset} ${r.totalMs}ms\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  const stats = engine.getStats();
  console.log(`${C.bold}Results:${C.reset} ${stats.repairs} repairs, $${stats.savedRevenue} saved, ${stats.immuneHits} immune, ${stats.geneCount} genes\n`);
  geneMap.close();
}

main().catch(console.error);
