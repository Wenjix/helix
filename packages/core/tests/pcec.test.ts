import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PcecEngine } from '../src/engine/pcec.js';
import { GeneMap } from '../src/engine/gene-map.js';
import { bus } from '../src/engine/bus.js';
import { defaultAdapters } from '../src/platforms/index.js';
import type { SseEvent } from '../src/engine/types.js';

function createTestEngine(opts: Record<string, unknown> = {}) {
  const geneMap = new GeneMap(':memory:');
  const engine = new PcecEngine(geneMap, 'test-agent', { mode: 'auto', ...opts } as any);
  for (const adapter of defaultAdapters) engine.registerAdapter(adapter);
  return { engine, geneMap };
}

describe('PcecEngine', () => {
  let engine: PcecEngine;
  let geneMap: GeneMap;

  beforeEach(() => {
    const t = createTestEngine();
    engine = t.engine;
    geneMap = t.geneMap;
    bus.clear();
  });

  afterEach(() => { geneMap.close(); });

  it('repairs a known error and stores Gene', async () => {
    const error = new Error('Payment of 500 USDC failed: insufficient balance (have 12.50 USDC)');
    (error as any).code = 'payment-insufficient';
    const result = await engine.repair(error);
    expect(result.success).toBe(true);
    expect(result.immune).toBe(false);
    expect(result.winner).not.toBeNull();
    expect(result.verified).toBe(true);
    expect(result.explanation).toContain('Perceived');
  });

  it('becomes immune on second encounter', async () => {
    const error = new Error('Transaction signature invalid: nonce mismatch');
    (error as any).code = 'verification-failed';
    const r1 = await engine.repair(error);
    expect(r1.success).toBe(true);
    expect(r1.immune).toBe(false);

    const r2 = await engine.repair(error);
    expect(r2.success).toBe(true);
    expect(r2.immune).toBe(true);
  });

  it('classifies unknown errors gracefully', async () => {
    const result = await engine.repair(new Error('Some completely unknown error type'));
    expect(result.failure.code).toBe('unknown');
    expect(result.failure.category).toBe('unknown');
  });

  it('emits events via EventBus', async () => {
    const events: SseEvent[] = [];
    const unsub = bus.subscribe(e => events.push(e));
    const error = new Error('Payment of 500 USDC failed: insufficient balance');
    (error as any).code = 'payment-insufficient';
    await engine.repair(error);
    unsub();
    const types = events.map(e => e.type);
    expect(types).toContain('perceive');
    expect(types).toContain('construct');
    expect(types).toContain('evaluate');
    expect(types).toContain('commit');
    expect(types).toContain('verify');
  });

  it('tracks stats correctly', async () => {
    const error = new Error('Payment of 500 USDC failed: insufficient balance');
    (error as any).code = 'payment-insufficient';
    await engine.repair(error);
    await engine.repair(error); // immune
    const stats = engine.getStats();
    expect(stats.repairs).toBe(2);
    expect(stats.immuneHits).toBe(1);
    expect(stats.geneCount).toBe(1);
  });
});

describe('Observe Mode', () => {
  it('returns recommendation without executing', async () => {
    const { engine, geneMap } = createTestEngine({ mode: 'observe' });
    const result = await engine.repair(new Error('429 Too Many Requests'));
    expect(result.mode).toBe('observe');
    expect(result.winner).not.toBeNull();
    expect(result.explanation).toContain('Perceived');
    expect(result.explanation).toContain('Selected');
    // In observe mode, Gene should NOT be stored (no commit happened)
    expect(geneMap.immuneCount()).toBe(0);
    geneMap.close();
  });
});

describe('Cost Ceiling', () => {
  it('filters out strategies exceeding cost ceiling', async () => {
    // Set ceiling so low that expensive strategies are filtered
    const { engine, geneMap } = createTestEngine({ maxRepairCostUsd: 0.001 });
    const error = new Error('Payment of 500 USDC failed: insufficient balance (have 12.50 USDC)');
    (error as any).code = 'payment-insufficient';
    const result = await engine.repair(error);
    // The balance strategies include swap_currency ($0.50) and topup ($0.10)
    // which exceed the $0.001 ceiling — they should be filtered
    expect(result.skippedStrategies).toBeDefined();
    const costSkipped = result.skippedStrategies!.filter(s => s.includes('cost'));
    expect(costSkipped.length).toBeGreaterThan(0);
    geneMap.close();
  });
});

describe('Explain', () => {
  it('provides human-readable explanation', async () => {
    const { engine, geneMap } = createTestEngine({ mode: 'observe' });
    // Use an error with candidates (balance has 3 strategies, all no-provider-needed)
    const error = new Error('Payment of 500 USDC failed: insufficient balance (have 12.50 USDC)');
    (error as any).code = 'payment-insufficient';
    const result = await engine.repair(error);
    expect(result.explanation).toContain('Perceived');
    expect(result.explanation).toContain('payment-insufficient');
    expect(result.explanation).toContain('Selected');
    geneMap.close();
  });
});
