#!/usr/bin/env node
/**
 * Pulls approved discoveries from Gene Collector and shows
 * what to add to seed-genes.ts for the next npm publish.
 *
 * Run: npx tsx scripts/update-seed-genes.ts
 */

const API = process.env.HELIX_API ?? 'https://helix-production-e110.up.railway.app';

async function main() {
  console.log('Fetching approved discoveries...\n');
  try {
    const res = await fetch(`${API}/api/discoveries?approved=true`);
    if (!res.ok) { console.log(`API returned ${res.status}. No discoveries endpoint yet.`); return; }
    const discoveries = await res.json();
    if (!Array.isArray(discoveries) || discoveries.length === 0) { console.log('No new approved discoveries.'); return; }

    console.log(`Found ${discoveries.length} approved discoveries:\n`);
    for (const d of discoveries) {
      console.log(`  ${d.code}/${d.category} → ${d.strategy} (${d.report_count ?? 1}× reports, q=${(d.avg_q ?? 0.6).toFixed(2)})`);
      console.log(`    Pattern: "${d.error_pattern}"`);
      if (d.reasoning) console.log(`    Reasoning: ${d.reasoning}`);
      console.log('');
    }
  } catch (e: any) {
    console.log(`Could not reach API: ${e.message}`);
  }
}

main();
