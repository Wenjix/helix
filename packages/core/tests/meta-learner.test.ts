import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MetaLearner } from '../src/engine/meta-learner.js';

describe('Meta-Learning Repair', () => {
  let db: Database.Database;
  let ml: MetaLearner;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE genes (id INTEGER PRIMARY KEY AUTOINCREMENT, failure_code TEXT, category TEXT, strategy TEXT, q_value REAL DEFAULT 0.5, platforms TEXT DEFAULT '[]', success_count INTEGER DEFAULT 3, consecutive_failures INTEGER DEFAULT 0, avg_repair_ms REAL DEFAULT 5)`);
    ml = new MetaLearner(db);
  });
  afterEach(() => db.close());

  it('findSimilarGenes returns matching genes', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'refresh_nonce', 0.7);
    const similar = ml.findSimilarGenes('nonce invalid');
    expect(similar.length).toBeGreaterThan(0);
  });

  it('learnPattern creates pattern with 3+ similar', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'refresh_nonce', 0.7);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-expired', 'nonce', 'refresh_nonce', 0.6);
    const p = ml.learnPattern('nonce desync');
    expect(p).not.toBeNull();
    expect(p!.strategy).toBe('refresh_nonce');
    expect(p!.exampleCount).toBeGreaterThanOrEqual(3);
  });

  it('learnPattern returns null with < 3', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'refresh_nonce', 0.7);
    expect(ml.learnPattern('nonce desync')).toBeNull();
  });

  it('learnPattern returns null when strategies disagree', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'backoff_retry', 0.7);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-expired', 'nonce', 'reduce_request', 0.6);
    expect(ml.learnPattern('nonce desync')).toBeNull();
  });

  it('matchPattern returns stored pattern', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'refresh_nonce', 0.7);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-expired', 'nonce', 'refresh_nonce', 0.6);
    ml.learnPattern('nonce test');
    const m = ml.matchPattern('nonce desynchronized');
    expect(m).not.toBeNull();
    expect(m!.strategy).toBe('refresh_nonce');
    expect(m!.source).toBe('meta-learning');
  });

  it('getPatterns returns all', () => {
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-mismatch', 'nonce', 'refresh_nonce', 0.8);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-too-low', 'nonce', 'refresh_nonce', 0.7);
    db.prepare("INSERT INTO genes (failure_code, category, strategy, q_value) VALUES (?,?,?,?)").run('nonce-expired', 'nonce', 'refresh_nonce', 0.6);
    ml.learnPattern('nonce');
    expect(ml.getPatterns().length).toBeGreaterThan(0);
  });
});
