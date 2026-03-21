import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeneMap } from '../src/engine/gene-map.js';

describe('GeneMap', () => {
  let geneMap: GeneMap;

  beforeEach(() => {
    geneMap = new GeneMap(':memory:');
  });

  afterEach(() => {
    geneMap.close();
  });

  it('stores and retrieves a gene', () => {
    geneMap.store({
      failureCode: 'payment-insufficient', category: 'balance', strategy: 'reduce_request',
      params: {}, successCount: 1, avgRepairMs: 150, platforms: ['tempo'],
      qValue: 0.5, consecutiveFailures: 0,
    });
    const gene = geneMap.lookup('payment-insufficient', 'balance');
    expect(gene).not.toBeNull();
    expect(gene!.strategy).toBe('reduce_request');
    expect(gene!.platforms).toContain('tempo');
  });

  it('lookup is by (code, category) not by platform', () => {
    geneMap.store({
      failureCode: 'verification-failed', category: 'signature', strategy: 'refresh_nonce',
      params: {}, successCount: 1, avgRepairMs: 200, platforms: ['tempo'],
      qValue: 0.5, consecutiveFailures: 0,
    });
    const gene = geneMap.lookup('verification-failed', 'signature');
    expect(gene).not.toBeNull();
    expect(gene!.strategy).toBe('refresh_nonce');
  });

  it('returns null for missing genes', () => {
    expect(geneMap.lookup('nonexistent', 'unknown')).toBeNull();
  });

  it('updates platforms array when new platform uses a gene', () => {
    geneMap.store({
      failureCode: 'verification-failed', category: 'signature', strategy: 'refresh_nonce',
      params: {}, successCount: 1, avgRepairMs: 200, platforms: ['tempo'],
      qValue: 0.5, consecutiveFailures: 0,
    });
    geneMap.addPlatform('verification-failed', 'signature', 'privy');
    const gene = geneMap.lookup('verification-failed', 'signature');
    expect(gene!.platforms).toContain('tempo');
    expect(gene!.platforms).toContain('privy');
  });

  it('does not duplicate platforms', () => {
    geneMap.store({
      failureCode: 'rate-limited', category: 'auth', strategy: 'backoff_retry',
      params: {}, successCount: 1, avgRepairMs: 2000, platforms: ['generic'],
      qValue: 0.5, consecutiveFailures: 0,
    });
    geneMap.addPlatform('rate-limited', 'auth', 'generic');
    const gene = geneMap.lookup('rate-limited', 'auth');
    expect(gene!.platforms.filter(p => p === 'generic').length).toBe(1);
  });

  it('lists all genes sorted by q_value', () => {
    geneMap.store({ failureCode: 'a', category: 'balance', strategy: 's1', params: {}, successCount: 5, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.3, consecutiveFailures: 0 });
    geneMap.store({ failureCode: 'b', category: 'session', strategy: 's2', params: {}, successCount: 2, avgRepairMs: 200, platforms: ['tempo'], qValue: 0.9, consecutiveFailures: 0 });
    const list = geneMap.list();
    expect(list.length).toBe(2);
    expect(list[0].failureCode).toBe('b'); // higher q_value first
  });

  it('reports immune count', () => {
    expect(geneMap.immuneCount()).toBe(0);
    geneMap.store({ failureCode: 'a', category: 'balance', strategy: 's', params: {}, successCount: 1, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.5, consecutiveFailures: 0 });
    expect(geneMap.immuneCount()).toBe(1);
  });
});

describe('Q-Value (MemRL)', () => {
  let geneMap: GeneMap;

  beforeEach(() => {
    geneMap = new GeneMap(':memory:');
  });

  afterEach(() => {
    geneMap.close();
  });

  it('increases q_value on success', () => {
    geneMap.store({ failureCode: 'test', category: 'test', strategy: 's', params: {}, successCount: 1, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.5, consecutiveFailures: 0 });
    geneMap.recordSuccess('test', 'test', 100);
    const gene = geneMap.lookup('test', 'test');
    expect(gene!.qValue).toBeGreaterThan(0.5);
  });

  it('decreases q_value on failure', () => {
    geneMap.store({ failureCode: 'test2', category: 'test2', strategy: 's', params: {}, successCount: 1, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.8, consecutiveFailures: 0 });
    geneMap.recordFailure('test2', 'test2');
    const gene = geneMap.lookup('test2', 'test2');
    expect(gene!.qValue).toBeLessThan(0.8);
  });

  it('q_value converges toward 1.0 with repeated success', () => {
    geneMap.store({ failureCode: 'test3', category: 'test3', strategy: 's', params: {}, successCount: 1, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.5, consecutiveFailures: 0 });
    for (let i = 0; i < 20; i++) {
      geneMap.recordSuccess('test3', 'test3', 100);
    }
    const gene = geneMap.lookup('test3', 'test3');
    expect(gene!.qValue).toBeGreaterThan(0.85);
  });

  it('resets consecutive failures on success', () => {
    geneMap.store({ failureCode: 'test4', category: 'test4', strategy: 's', params: {}, successCount: 1, avgRepairMs: 100, platforms: ['tempo'], qValue: 0.5, consecutiveFailures: 3 });
    geneMap.recordSuccess('test4', 'test4', 100);
    const gene = geneMap.lookup('test4', 'test4');
    expect(gene!.consecutiveFailures).toBe(0);
  });
});
