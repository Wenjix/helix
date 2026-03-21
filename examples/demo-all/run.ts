#!/usr/bin/env node
import { PcecEngine, GeneMap, bus, defaultAdapters } from '@helix-agent/core';
import type { SseEvent } from '@helix-agent/core';
import { tempoScenarios } from './scenarios-tempo.js';
import { privyScenarios } from './scenarios-privy.js';
import { genericScenarios } from './scenarios-generic.js';
import { coinbaseScenarios } from './scenarios-coinbase.js';
import type { DemoScenario } from './scenarios-tempo.js';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  white: '\x1b[37m', bgRed: '\x1b[41m',
};

function platformBadge(p: string): string {
  switch (p) {
    case 'tempo': return `${C.yellow}[TEMPO]${C.reset}`;
    case 'privy': return `${C.blue}[PRIVY]${C.reset}`;
    case 'generic': return `${C.dim}[GENERIC]${C.reset}`;
    default: return `[${p}]`;
  }
}

bus.subscribe((event: SseEvent) => {
  const ts = new Date(event.timestamp).toISOString().slice(11, 23);
  const d = event.data;
  switch (event.type) {
    case 'perceive':
      console.log(`  ${C.dim}${ts}${C.reset} ${C.red}PERCEIVE${C.reset}  ${d.code} → ${d.category} [${d.severity}] ${platformBadge(d.platform as string)}`);
      break;
    case 'construct':
      console.log(`  ${C.dim}${ts}${C.reset} ${C.blue}CONSTRUCT${C.reset} ${d.candidateCount} candidates`);
      break;
    case 'evaluate':
      console.log(`  ${C.dim}${ts}${C.reset} ${C.magenta}EVALUATE${C.reset}  → ${d.winner} (score: ${d.score})`);
      break;
    case 'commit':
      if (d.success) console.log(`  ${C.dim}${ts}${C.reset} ${C.green}COMMIT ✓${C.reset}  ${d.strategy} (${d.totalMs}ms)`);
      break;
    case 'immune': {
      const cp = d.crossPlatform ? `, ${C.cyan}${C.bold}CROSS-PLATFORM${C.reset}` : '';
      console.log(`  ${C.dim}${ts}${C.reset} ${C.cyan}⚡ IMMUNE${C.reset}  ${d.strategy} (${d.successCount} fixes${cp})`);
      break;
    }
    case 'gene':
      console.log(`  ${C.dim}${ts}${C.reset} ${C.magenta}GENE 📦${C.reset}   ${d.category}/${d.code}`);
      break;
  }
});

async function run(engine: PcecEngine, scenario: DemoScenario) {
  const err = new Error(scenario.errorMessage);
  (err as unknown as Record<string, unknown>).code = scenario.errorCode;
  return engine.repair(err);
}

async function main() {
  console.log(`\n${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  ${C.bold}HELIX${C.reset} — Self-Healing Infrastructure for Agent Payments       ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  PCEC Engine × Gene Map × Multi-Platform (31 scenarios)       ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}\n`);

  const geneMap = new GeneMap(':memory:');
  const engine = new PcecEngine(geneMap, 'demo-agent');
  for (const adapter of defaultAdapters) engine.registerAdapter(adapter);

  let crossPlatformCount = 0;

  // ── Tempo ──
  console.log(`${C.yellow}━━━ ◆ Tempo / MPP (13 scenarios) ━━━${C.reset}\n`);
  for (const s of tempoScenarios) {
    const label = s.tag === 'real' ? `${C.bgRed}${C.white} REAL ${C.reset}` : `${C.dim}(${s.tag})${C.reset}`;
    console.log(`${C.bold}▸ ${s.id}.  ${s.name}${C.reset} ${label}`);
    const r = await run(engine, s);
    console.log(`  → ${r.success ? C.green + '✓ REPAIRED' : C.red + '✗ FAILED'}${C.reset} in ${r.totalMs}ms ($${r.revenueProtected} protected)\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  // ── Privy ──
  console.log(`${C.blue}━━━ ◇ Privy Wallet (7 scenarios) ━━━${C.reset}\n`);
  for (const s of privyScenarios) {
    console.log(`${C.bold}▸ ${s.id}. ${s.name}${C.reset} ${C.dim}(${s.tag})${C.reset}`);
    const r = await run(engine, s);
    const cp = r.immune && (r.gene?.platforms?.length ?? 0) > 1;
    if (cp) crossPlatformCount++;
    const msg = r.immune ? (cp ? `${C.cyan}⚡ CROSS-PLATFORM IMMUNE!${C.reset}` : `${C.cyan}⚡ IMMUNE${C.reset}`) : `${r.success ? C.green + '✓ REPAIRED' : C.red + '✗ FAILED'}${C.reset}`;
    console.log(`  → ${msg} in ${r.totalMs}ms ($${r.revenueProtected} protected)\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  // ── Generic ──
  console.log(`${C.dim}━━━ ○ Generic HTTP (3 scenarios) ━━━${C.reset}\n`);
  for (const s of genericScenarios) {
    console.log(`${C.bold}▸ ${s.id}. ${s.name}${C.reset} ${C.dim}(${s.tag})${C.reset}`);
    const r = await run(engine, s);
    const cp = r.immune && (r.gene?.platforms?.length ?? 0) > 1;
    if (cp) crossPlatformCount++;
    const msg = r.immune ? (cp ? `${C.cyan}⚡ CROSS-PLATFORM IMMUNE!${C.reset}` : `${C.cyan}⚡ IMMUNE${C.reset}`) : `${r.success ? C.green + '✓ REPAIRED' : C.red + '✗ FAILED'}${C.reset}`;
    console.log(`  → ${msg} in ${r.totalMs}ms ($${r.revenueProtected} protected)\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  // ── Coinbase ──
  console.log(`${C.yellow}━━━ ◎ Coinbase / CDP (8 scenarios) ━━━${C.reset}\n`);
  for (const s of coinbaseScenarios) {
    console.log(`${C.bold}▸ ${s.id}. ${s.name}${C.reset} ${C.dim}(${s.tag})${C.reset}`);
    const r = await run(engine, s);
    const cp = r.immune && (r.gene?.platforms?.length ?? 0) > 1;
    if (cp) crossPlatformCount++;
    const msg = r.immune ? (cp ? `${C.cyan}⚡ CROSS-PLATFORM IMMUNE!${C.reset}` : `${C.cyan}⚡ IMMUNE${C.reset}`) : `${r.success ? C.green + '✓ REPAIRED' : C.red + '✗ FAILED'}${C.reset}`;
    console.log(`  → ${msg} in ${r.totalMs}ms ($${r.revenueProtected} protected)\n`);
    await new Promise(r => setTimeout(r, 30));
  }

  // ── Cross-Platform Immunity ──
  console.log(`${C.cyan}━━━ ⚡ Cross-Platform Immunity ━━━${C.reset}\n`);
  const immunityTests = [
    { scenario: tempoScenarios[0], label: 'TEMPO IMMUNITY' },
    { scenario: privyScenarios[1], label: 'CROSS-PLATFORM (Gene from Tempo #4)' },
    { scenario: privyScenarios[2], label: 'CROSS-PLATFORM (Gene from Tempo #12)' },
    { scenario: privyScenarios[3], label: 'CROSS-PLATFORM (Gene from Tempo #13)' },
    { scenario: coinbaseScenarios[2], label: 'CROSS-PLATFORM CB (Gene from Tempo #4)' },
    { scenario: coinbaseScenarios[5], label: 'CROSS-PLATFORM CB (Gene from Tempo #13)' },
    { scenario: genericScenarios[1], label: 'CROSS-PLATFORM (Gene from Tempo #6)' },
    { scenario: tempoScenarios[12], label: 'REAL MPP, IMMUNITY' },
  ];
  for (const { scenario, label } of immunityTests) {
    console.log(`${C.bold}▸ ${scenario.id}.  ${scenario.name} ${C.cyan}[${label}]${C.reset}`);
    const r = await run(engine, scenario);
    if (r.immune) {
      if ((r.gene?.platforms?.length ?? 0) > 1) crossPlatformCount++;
      console.log(`  → ${C.cyan}${C.bold}IMMUNE ⚡${C.reset} in ${r.totalMs}ms\n`);
    } else {
      console.log(`  → ${C.green}✓ REPAIRED${C.reset} in ${r.totalMs}ms\n`);
    }
    await new Promise(r => setTimeout(r, 30));
  }

  // ── Summary ──
  const stats = engine.getStats();
  console.log(`${C.cyan}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  ${C.bold}HELIX DEMO COMPLETE${C.reset}                                         ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╠══════════════════════════════════════════════════════════════╣${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  Platforms: 5  |  Scenarios: 31  |  Repairs: ${stats.repairs}             ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  Immune: ${stats.immuneHits}  |  Cross-Platform: ${crossPlatformCount}  |  Genes: ${stats.geneCount}           ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}║${C.reset}  Revenue Saved: $${stats.savedRevenue.toLocaleString()}                                  ${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╚══════════════════════════════════════════════════════════════╝${C.reset}`);

  console.log(`\n${C.bold}Gene Map:${C.reset}`);
  for (const g of stats.genes) {
    const cp = g.platforms.length > 1 ? `  ${C.cyan}← CROSS-PLATFORM${C.reset}` : '';
    console.log(`  ${C.magenta}●${C.reset} ${g.category}/${g.failureCode} → ${g.strategy} (${g.platforms.join(', ')}) ${g.successCount} fixes${cp}`);
  }
  console.log('');
  geneMap.close();
}

main().catch(console.error);
