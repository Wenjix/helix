#!/usr/bin/env node
/**
 * Real Helix Example — NOT a simulation.
 * Calls httpbin.org which returns real HTTP error responses.
 * Helix wraps fetch and automatically handles the error.
 *
 * Run: npm run demo:real
 */
import { wrap } from '@helix-agent/core';

async function fetchWithThrow(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  }
  return await response.text();
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  HELIX — Real HTTP Example (not simulated)           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log();

  // ── Test 1: 429 Rate Limited ──
  console.log('▸ Test 1: httpbin.org/status/429 (real 429)');
  const resilientFetch = wrap(fetchWithThrow, { mode: 'auto', verbose: true, maxRetries: 1 });
  try {
    await resilientFetch('https://httpbin.org/status/429');
  } catch (err) {
    console.log('  Final error (expected — httpbin always 429):', (err as Error).message.slice(0, 60));
  }
  console.log();

  // ── Test 2: 500 Server Error ──
  console.log('▸ Test 2: httpbin.org/status/500 (real 500)');
  try {
    await resilientFetch('https://httpbin.org/status/500');
  } catch (err) {
    console.log('  Final error (expected):', (err as Error).message.slice(0, 60));
  }
  console.log();

  // ── Test 3: Observe Mode ──
  console.log('▸ Test 3: Observe mode — diagnose without executing');
  const observeFetch = wrap(fetchWithThrow, { mode: 'observe', maxRetries: 0 });
  try {
    await observeFetch('https://httpbin.org/status/429');
  } catch (err: unknown) {
    const e = err as Error & { helixRecommendation?: { winner?: { strategy: string }; explanation: string } };
    if (e.helixRecommendation) {
      console.log('  Helix recommendation:', e.helixRecommendation.winner?.strategy);
      console.log('  Explanation:', e.helixRecommendation.explanation.split('\n')[0]);
    }
  }
  console.log();

  // ── Test 4: Success passthrough ──
  console.log('▸ Test 4: httpbin.org/status/200 (should pass through)');
  try {
    await resilientFetch('https://httpbin.org/status/200');
    console.log('  Success! Helix did not interfere.');
  } catch (err) {
    console.log('  Error:', (err as Error).message.slice(0, 60));
  }

  console.log('\nDone. All tests used real HTTP calls to httpbin.org.');
}

main().catch(console.error);
