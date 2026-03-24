import { describe, it, expect } from 'vitest';
import { ABTestManager } from '../src/engine/ab-test.js';

describe('ABTestManager', () => {
  it('creates a test', () => {
    const manager = new ABTestManager();
    const test = manager.create({
      failureCode: 'payment-insufficient',
      failureCategory: 'balance',
      controlStrategy: 'topup_from_reserve',
      variantStrategy: 'switch_stablecoin',
    });

    expect(test.state).toBe('running');
    expect(test.controlStrategy).toBe('topup_from_reserve');
    expect(test.variantStrategy).toBe('switch_stablecoin');
    expect(test.failureCode).toBe('payment-insufficient');
    expect(test.failureCategory).toBe('balance');
    expect(test.id).toBeTruthy();
  });

  it('selectStrategy returns ~90/10 split over 1000 trials', () => {
    const manager = new ABTestManager();
    manager.create({
      failureCode: 'rate-limited',
      failureCategory: 'auth',
      controlStrategy: 'reduce_request',
      variantStrategy: 'switch_endpoint',
      variantTrafficRatio: 0.1,
    });

    let variantCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const result = manager.selectStrategy('rate-limited', 'auth');
      if (result?.isVariant) variantCount++;
    }

    // Expect variant between 5% and 15% (i.e. 50–150 out of 1000)
    expect(variantCount).toBeGreaterThan(50);
    expect(variantCount).toBeLessThan(150);
  });

  it('returns null when no test exists', () => {
    const manager = new ABTestManager();
    const result = manager.selectStrategy('unknown', 'unknown');
    expect(result).toBeNull();
  });

  it('variant wins when significantly better', () => {
    const manager = new ABTestManager();
    const test = manager.create({
      failureCode: 'gas-estimation-failed',
      failureCategory: 'gas',
      controlStrategy: 'refresh_nonce',
      variantStrategy: 'self_pay_gas',
      minTrials: 20,
      variantTrafficRatio: 0.5,
    });

    // Control: 10/20 = 50%
    for (let i = 0; i < 20; i++) {
      manager.recordResult('gas-estimation-failed', 'gas', 'refresh_nonce', i < 10);
    }

    // Variant: 18/20 = 90% — clearly better (>10% above control)
    for (let i = 0; i < 20; i++) {
      manager.recordResult('gas-estimation-failed', 'gas', 'self_pay_gas', i < 18);
    }

    expect(test.state).toBe('variant_wins');
    expect(test.concludedAt).toBeDefined();
  });

  it('control wins when variant is worse', () => {
    const manager = new ABTestManager();
    const test = manager.create({
      failureCode: 'timeout',
      failureCategory: 'service',
      controlStrategy: 'switch_endpoint',
      variantStrategy: 'reduce_request',
      minTrials: 20,
      variantTrafficRatio: 0.5,
    });

    // Interleave results so evaluation doesn't trigger on early lucky variant runs.
    // Control: 18/20 = 90%; Variant: 4/20 = 20% (clearly worse)
    for (let i = 0; i < 20; i++) {
      // control succeeds most of the time
      manager.recordResult('timeout', 'service', 'switch_endpoint', i < 18);
      // variant fails most of the time
      manager.recordResult('timeout', 'service', 'reduce_request', i < 4);
    }

    expect(test.state).toBe('control_wins');
    expect(test.concludedAt).toBeDefined();
  });

  it('inconclusive after many trials with similar performance', () => {
    const manager = new ABTestManager();
    const test = manager.create({
      failureCode: 'wrong-network',
      failureCategory: 'network',
      controlStrategy: 'switch_network',
      variantStrategy: 'fix_params',
      minTrials: 10,
      variantTrafficRatio: 0.5,
    });

    // Record identical results for both arms in lockstep.
    // Each pair: one control result then one variant result with same outcome.
    // 3 × minTrials(10) = 30 total needed for inconclusive. Record 16 pairs = 32 total.
    for (let i = 0; i < 16; i++) {
      const success = i % 5 !== 4; // 80% success: SSSSS SSSSS SSSSS F pattern per arm
      manager.recordResult('wrong-network', 'network', 'switch_network', success);
      manager.recordResult('wrong-network', 'network', 'fix_params', success);
    }

    expect(test.state).toBe('inconclusive');
    expect(test.concludedAt).toBeDefined();
  });

  it('duplicate test returns existing running test', () => {
    const manager = new ABTestManager();
    const test1 = manager.create({
      failureCode: 'payment-insufficient',
      failureCategory: 'balance',
      controlStrategy: 'topup_from_reserve',
      variantStrategy: 'switch_stablecoin',
    });

    const test2 = manager.create({
      failureCode: 'payment-insufficient',
      failureCategory: 'balance',
      controlStrategy: 'different_strategy',
      variantStrategy: 'another_strategy',
    });

    expect(test2.id).toBe(test1.id);
    expect(test2.controlStrategy).toBe('topup_from_reserve');
  });

  it('getResults returns only completed tests', () => {
    const manager = new ABTestManager();

    // Running test
    manager.create({
      failureCode: 'rate-limited',
      failureCategory: 'auth',
      controlStrategy: 'reduce_request',
      variantStrategy: 'switch_endpoint',
      minTrials: 10,
      variantTrafficRatio: 0.5,
    });

    // Create a concluded test (variant wins)
    manager.create({
      failureCode: 'timeout',
      failureCategory: 'service',
      controlStrategy: 'switch_endpoint',
      variantStrategy: 'reduce_request',
      minTrials: 10,
      variantTrafficRatio: 0.5,
    });
    for (let i = 0; i < 15; i++) {
      manager.recordResult('timeout', 'service', 'switch_endpoint', i < 5);
    }
    for (let i = 0; i < 15; i++) {
      manager.recordResult('timeout', 'service', 'reduce_request', i < 14);
    }

    const results = manager.getResults();
    expect(results.length).toBe(1);
    expect(results[0].state).not.toBe('running');
    expect(results[0].failureCode).toBe('timeout');
  });

  it('getAllTests returns all tests including running', () => {
    const manager = new ABTestManager();
    manager.create({
      failureCode: 'test-a',
      failureCategory: 'balance',
      controlStrategy: 'a',
      variantStrategy: 'b',
    });
    manager.create({
      failureCode: 'test-b',
      failureCategory: 'service',
      controlStrategy: 'c',
      variantStrategy: 'd',
    });

    expect(manager.getAllTests().length).toBe(2);
  });

  it('getTest returns the test for a given code/category', () => {
    const manager = new ABTestManager();
    manager.create({
      failureCode: 'payment-insufficient',
      failureCategory: 'balance',
      controlStrategy: 'topup_from_reserve',
      variantStrategy: 'switch_stablecoin',
    });

    const test = manager.getTest('payment-insufficient', 'balance');
    expect(test).toBeDefined();
    expect(test!.controlStrategy).toBe('topup_from_reserve');
  });
});
