import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/engine/evaluate.js';
import type { FailureClassification, RepairCandidate } from '../src/engine/types.js';

function makeFailure(overrides: Partial<FailureClassification> = {}): FailureClassification {
  return {
    code: 'payment-insufficient',
    category: 'balance',
    severity: 'high',
    platform: 'tempo',
    details: 'test',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<RepairCandidate> = {}): RepairCandidate {
  return {
    id: 'test',
    strategy: 'test_strategy',
    description: 'test',
    estimatedCostUsd: 0.10,
    estimatedSpeedMs: 500,
    requirements: [],
    score: 0,
    successProbability: 0.5,
    platform: 'tempo',
    ...overrides,
  };
}

describe('evaluate', () => {
  it('scores and sorts candidates by descending score', () => {
    const failure = makeFailure();
    const candidates = [
      makeCandidate({ id: 'slow', estimatedSpeedMs: 5000, estimatedCostUsd: 0 }),
      makeCandidate({ id: 'fast', estimatedSpeedMs: 100, estimatedCostUsd: 0 }),
    ];
    const scored = evaluate(candidates, failure);
    expect(scored[0].id).toBe('fast');
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it('penalizes candidates with more requirements', () => {
    const failure = makeFailure();
    const candidates = [
      makeCandidate({ id: 'no_reqs', requirements: [], estimatedSpeedMs: 500 }),
      makeCandidate({ id: 'many_reqs', requirements: ['a', 'b', 'c'], estimatedSpeedMs: 500 }),
    ];
    const scored = evaluate(candidates, failure);
    expect(scored[0].id).toBe('no_reqs');
  });

  it('applies severity bonus', () => {
    const low = evaluate([makeCandidate()], makeFailure({ severity: 'low' }));
    const critical = evaluate([makeCandidate()], makeFailure({ severity: 'critical' }));
    expect(critical[0].score).toBeGreaterThan(low[0].score);
  });

  it('factors in success probability', () => {
    const failure = makeFailure();
    const candidates = [
      makeCandidate({ id: 'lucky', successProbability: 0.95, estimatedSpeedMs: 500 }),
      makeCandidate({ id: 'risky', successProbability: 0.1, estimatedSpeedMs: 500 }),
    ];
    const scored = evaluate(candidates, failure);
    expect(scored[0].id).toBe('lucky');
  });

  it('caps score at 100', () => {
    const failure = makeFailure({ severity: 'critical' });
    const candidates = [makeCandidate({ estimatedCostUsd: 0, estimatedSpeedMs: 1, successProbability: 1.0, requirements: [] })];
    const scored = evaluate(candidates, failure);
    expect(scored[0].score).toBeLessThanOrEqual(100);
  });
});
