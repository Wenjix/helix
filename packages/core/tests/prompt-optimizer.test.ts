import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { PromptOptimizer } from '../src/engine/prompt-optimizer.js';

describe('Prompt Optimizer (Generic)', () => {
  let db: Database.Database;
  let opt: PromptOptimizer;

  beforeEach(() => {
    db = new Database(':memory:');
    opt = new PromptOptimizer(db, 5, 10); // 5 examples, min 10 records
  });
  afterEach(() => db.close());

  test('record stores classification', () => {
    opt.record({
      errorMessage: 'something failed',
      predictedCode: 'err-1',
      predictedCategory: 'network',
      predictedStrategy: 'retry',
      actualOutcome: 'unknown',
    });
    const stats = opt.getStats();
    expect(stats.total).toBe(1);
    expect(stats.unknown).toBe(1);
  });

  test('updateOutcome marks classification as correct', () => {
    opt.record({
      errorMessage: 'timeout error',
      predictedCode: 'timeout',
      predictedCategory: 'network',
      predictedStrategy: 'retry',
      actualOutcome: 'unknown',
    });
    opt.updateOutcome('timeout error', 'retry', true);
    const stats = opt.getStats();
    expect(stats.correct).toBe(1);
  });

  test('updateOutcome marks classification as incorrect', () => {
    opt.record({
      errorMessage: 'timeout error',
      predictedCode: 'timeout',
      predictedCategory: 'network',
      predictedStrategy: 'retry',
      actualOutcome: 'unknown',
    });
    opt.updateOutcome('timeout error', 'retry', false);
    const stats = opt.getStats();
    expect(stats.incorrect).toBe(1);
  });

  test('getBestExamples returns empty when too few records', () => {
    opt.record({
      errorMessage: 'error',
      predictedCode: 'e1',
      predictedCategory: 'cat',
      predictedStrategy: 'fix',
      actualOutcome: 'correct',
      repairSucceeded: true,
    });
    expect(opt.getBestExamples().length).toBe(0);
  });

  test('getBestExamples returns examples when enough data', () => {
    for (let i = 0; i < 15; i++) {
      opt.record({
        errorMessage: `error type ${i % 3}`,
        predictedCode: `code-${i % 3}`,
        predictedCategory: `cat-${i % 3}`,
        predictedStrategy: `fix-${i % 3}`,
        actualOutcome: 'correct',
        repairSucceeded: true,
      });
    }
    const examples = opt.getBestExamples();
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.length).toBeLessThanOrEqual(5);
  });

  test('examples have category diversity', () => {
    for (let i = 0; i < 30; i++) {
      opt.record({
        errorMessage: `error ${i}`,
        predictedCode: `code-${i % 3}`,
        predictedCategory: `category-${i % 3}`,
        predictedStrategy: `strategy-${i % 3}`,
        actualOutcome: 'correct',
        repairSucceeded: true,
      });
    }
    const examples = opt.getBestExamples();
    const categories = new Set(examples.map(e => e.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  test('buildFewShotPrompt returns empty string when not enough data', () => {
    expect(opt.buildFewShotPrompt()).toBe('');
  });

  test('buildFewShotPrompt returns formatted string with examples', () => {
    for (let i = 0; i < 15; i++) {
      opt.record({
        errorMessage: `error ${i}`,
        predictedCode: `code-${i}`,
        predictedCategory: `cat-${i % 3}`,
        predictedStrategy: `fix-${i}`,
        actualOutcome: 'correct',
        repairSucceeded: true,
      });
    }
    const prompt = opt.buildFewShotPrompt();
    expect(prompt).toContain('correctly classified');
    expect(prompt).toContain('Error:');
    expect(prompt).toContain('category:');
    expect(prompt).toContain('strategy:');
  });

  test('accuracy calculation is correct', () => {
    for (let i = 0; i < 8; i++) {
      opt.record({
        errorMessage: `error ${i}`,
        predictedCode: `c${i}`,
        predictedCategory: 'cat',
        predictedStrategy: 'fix',
        actualOutcome: 'correct',
        repairSucceeded: true,
      });
    }
    for (let i = 0; i < 2; i++) {
      opt.record({
        errorMessage: `error bad ${i}`,
        predictedCode: `c${i}`,
        predictedCategory: 'cat',
        predictedStrategy: 'fix',
        actualOutcome: 'incorrect',
        repairSucceeded: false,
      });
    }
    const stats = opt.getStats();
    expect(stats.accuracy).toBeCloseTo(0.8, 1);
  });

  test('prune keeps only last N records', () => {
    for (let i = 0; i < 20; i++) {
      opt.record({
        errorMessage: `error ${i}`,
        predictedCode: `c${i}`,
        predictedCategory: 'cat',
        predictedStrategy: 'fix',
        actualOutcome: 'correct',
      });
    }
    const pruned = opt.prune(10);
    expect(pruned).toBe(10);
    expect(opt.getStats().total).toBe(10);
  });

  test('works with arbitrary domain strings', () => {
    opt.record({
      errorMessage: 'FLUX_CAPACITOR_OVERLOAD: temporal sync failed',
      predictedCode: 'flux-overload',
      predictedCategory: 'time-travel',
      predictedStrategy: 'reverse_polarity',
      actualOutcome: 'correct',
      repairSucceeded: true,
    });
    const stats = opt.getStats();
    expect(stats.total).toBe(1);
    expect(stats.correct).toBe(1);
  });
});
