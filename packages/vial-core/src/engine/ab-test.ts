/**
 * Strategy A/B Testing manager.
 * Tracks control vs. variant strategy performance for each failure type.
 */

export interface ABTest {
  id: string;
  failureCode: string;
  failureCategory: string;
  controlStrategy: string;
  variantStrategy: string;
  variantTrafficRatio: number;
  minTrials: number;
  state: 'running' | 'variant_wins' | 'control_wins' | 'inconclusive';
  controlSuccesses: number;
  controlTrials: number;
  variantSuccesses: number;
  variantTrials: number;
  startedAt: number;
  concludedAt?: number;
}

export interface CreateABTestParams {
  failureCode: string;
  failureCategory: string;
  controlStrategy: string;
  variantStrategy: string;
  variantTrafficRatio?: number;
  minTrials?: number;
}

function makeKey(failureCode: string, failureCategory: string): string {
  return `${failureCode}:${failureCategory}`;
}

function makeId(): string {
  return `ab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ABTestManager {
  private tests: Map<string, ABTest> = new Map();

  /** Create a new A/B test. If one already exists and is running, return existing. */
  create(params: CreateABTestParams): ABTest {
    const key = makeKey(params.failureCode, params.failureCategory);
    const existing = this.tests.get(key);
    if (existing && existing.state === 'running') {
      return existing;
    }

    const test: ABTest = {
      id: makeId(),
      failureCode: params.failureCode,
      failureCategory: params.failureCategory,
      controlStrategy: params.controlStrategy,
      variantStrategy: params.variantStrategy,
      variantTrafficRatio: params.variantTrafficRatio ?? 0.1,
      minTrials: params.minTrials ?? 30,
      state: 'running',
      controlSuccesses: 0,
      controlTrials: 0,
      variantSuccesses: 0,
      variantTrials: 0,
      startedAt: Date.now(),
    };

    this.tests.set(key, test);
    return test;
  }

  /**
   * Select a strategy for the given failure.
   * Returns `{ strategy, isVariant }` or null if no test exists.
   */
  selectStrategy(
    failureCode: string,
    failureCategory: string,
  ): { strategy: string; isVariant: boolean } | null {
    const key = makeKey(failureCode, failureCategory);
    const test = this.tests.get(key);
    if (!test || test.state !== 'running') return null;

    const isVariant = Math.random() < test.variantTrafficRatio;
    return {
      strategy: isVariant ? test.variantStrategy : test.controlStrategy,
      isVariant,
    };
  }

  /** Record an outcome and auto-evaluate. */
  recordResult(
    failureCode: string,
    failureCategory: string,
    strategy: string,
    success: boolean,
  ): void {
    const key = makeKey(failureCode, failureCategory);
    const test = this.tests.get(key);
    if (!test || test.state !== 'running') return;

    if (strategy === test.variantStrategy) {
      test.variantTrials++;
      if (success) test.variantSuccesses++;
    } else {
      test.controlTrials++;
      if (success) test.controlSuccesses++;
    }

    this.evaluate(test);
  }

  /** Evaluate whether the test has reached a conclusion. Mutates test in place. */
  evaluate(test: ABTest): void {
    if (test.state !== 'running') return;

    const totalTrials = test.controlTrials + test.variantTrials;
    if (totalTrials < test.minTrials) return;
    if (test.variantTrials < 5 || test.controlTrials < 5) return;

    const controlRate =
      test.controlTrials > 0 ? test.controlSuccesses / test.controlTrials : 0;
    const variantRate =
      test.variantTrials > 0 ? test.variantSuccesses / test.variantTrials : 0;

    const improvement = variantRate - controlRate;
    if (improvement > 0.1) {
      test.state = 'variant_wins';
      test.concludedAt = Date.now();
    } else if (improvement < -0.1) {
      test.state = 'control_wins';
      test.concludedAt = Date.now();
    } else if (totalTrials >= test.minTrials * 3) {
      test.state = 'inconclusive';
      test.concludedAt = Date.now();
    }
  }

  getTest(code: string, cat: string): ABTest | undefined {
    return this.tests.get(makeKey(code, cat));
  }

  getAllTests(): ABTest[] {
    return [...this.tests.values()];
  }

  /** Returns only completed (non-running) tests. */
  getResults(): ABTest[] {
    return [...this.tests.values()].filter(t => t.state !== 'running');
  }
}
