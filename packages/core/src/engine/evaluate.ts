import type { FailureClassification, RepairCandidate, Severity } from './types.js';

export function evaluate(candidates: RepairCandidate[], failure: FailureClassification): RepairCandidate[] {
  const maxSpeed = Math.max(...candidates.map((c) => c.estimatedSpeedMs), 1);
  const maxCost = Math.max(...candidates.map((c) => c.estimatedCostUsd), 0.01);

  const severityBonus: Record<Severity, number> = {
    low: 0,
    medium: 5,
    high: 10,
    critical: 20,
  };

  return candidates
    .map((c) => {
      const speedScore = 25 * (1 - c.estimatedSpeedMs / maxSpeed);
      const costScore = 25 * (1 - c.estimatedCostUsd / maxCost);
      const reqScore = 15 * (1 - c.requirements.length / 3);
      const probScore = 25 * (c.successProbability ?? 0.5);
      const sevBonus = severityBonus[failure.severity];
      const score = Math.min(100, Math.round(speedScore + costScore + reqScore + probScore + sevBonus));
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
}
