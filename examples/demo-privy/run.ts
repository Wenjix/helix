#!/usr/bin/env node
import { PcecEngine, GeneMap, bus, defaultAdapters } from '@helix-agent/core';
import type { SseEvent } from '@helix-agent/core';
import { tempoScenarios } from '../demo-all/scenarios-tempo.js';
import { privyScenarios } from '../demo-all/scenarios-privy.js';

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m' };

bus.subscribe((e: SseEvent) => {
  const ts = new Date(e.timestamp).toISOString().slice(11, 23);
  const d = e.data;
  if (e.type === 'perceive') console.log(`  ${C.dim}${ts}${C.reset} ${C.red}PERCEIVE${C.reset}  ${d.code} → ${d.category} [${d.platform}]`);
  if (e.type === 'evaluate') console.log(`  ${C.dim}${ts}${C.reset} ${C.magenta}EVALUATE${C.reset}  → ${d.winner} (score: ${d.score})`);
  if (e.type === 'commit' && d.success) console.log(`  ${C.dim}${ts}${C.reset} ${C.green}COMMIT ✓${C.reset}  ${d.strategy} (${d.totalMs}ms)`);
  if (e.type === 'immune') console.log(`  ${C.dim}${ts}${C.reset} ${C.cyan}⚡ IMMUNE${C.reset}  ${d.strategy}${d.crossPlatform ? ' CROSS-PLATFORM' : ''}`);
});

async function main() {
  console.log(`\n${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  ${C.bold}HELIX${C.reset} — Privy Wallet Demo (7 scenarios + cross-platform)      ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}\n`);

  const geneMap = new GeneMap(':memory:');
  const engine = new PcecEngine(geneMap, 'privy-demo');
  for (const a of defaultAdapters) engine.registerAdapter(a);

  // Teaching phase: overlapping Tempo scenarios
  const overlap = [tempoScenarios[0], tempoScenarios[3], tempoScenarios[5], tempoScenarios[7], tempoScenarios[12], tempoScenarios[6]];
  console.log(`${C.yellow}━━━ ◆ Teaching Phase: Tempo (shared categories) ━━━${C.reset}\n`);
  for (const s of overlap) {
    console.log(`${C.bold}▸ ${s.id}.  ${s.name}${C.reset} ${C.yellow}[TEMPO]${C.reset}`);
    const err = new Error(s.errorMessage);
    (err as unknown as Record<string, unknown>).code = s.errorCode;
    const r = await engine.repair(err);
    console.log(`  → ${C.green}✓${C.reset} ${r.totalMs}ms — Gene stored\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  // Privy scenarios
  console.log(`${C.blue}━━━ ◇ Privy Scenarios (7 unique) ━━━${C.reset}\n`);
  for (const s of privyScenarios) {
    console.log(`${C.bold}▸ ${s.id}. ${s.name}${C.reset} ${C.blue}[PRIVY]${C.reset}`);
    const err = new Error(s.errorMessage);
    (err as unknown as Record<string, unknown>).code = s.errorCode;
    const r = await engine.repair(err);
    if (r.immune) {
      const cp = (r.gene?.platforms?.length ?? 0) > 1;
      console.log(`  → ${C.cyan}⚡ IMMUNE${C.reset} ${r.totalMs}ms${cp ? ` ${C.cyan}CROSS-PLATFORM!${C.reset}` : ''}`);
      if (r.gene) console.log(`  → Gene platforms: ${r.gene.platforms.join(', ')}`);
    } else {
      console.log(`  → ${C.green}✓ REPAIRED${C.reset} ${r.totalMs}ms ($${r.revenueProtected})`);
    }
    console.log('');
    await new Promise(r => setTimeout(r, 30));
  }

  const stats = engine.getStats();
  console.log(`${C.bold}Results:${C.reset} ${stats.repairs} repairs, $${stats.savedRevenue} saved, ${stats.immuneHits} immune, ${stats.geneCount} genes\n`);
  for (const g of stats.genes) {
    const cp = g.platforms.length > 1 ? `  ${C.cyan}← CROSS-PLATFORM${C.reset}` : '';
    console.log(`  ${C.magenta}●${C.reset} ${g.category}/${g.failureCode} → ${g.strategy} (${g.platforms.join(', ')})${cp}`);
  }
  console.log('');
  geneMap.close();
}

main().catch(console.error);
