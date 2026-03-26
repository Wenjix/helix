import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { StrategyGenerator } from '../src/engine/strategy-generator.js';

describe('Auto Strategy Generation', () => {
  let db: Database.Database;
  let gen: StrategyGenerator;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE IF NOT EXISTS genes (id INTEGER PRIMARY KEY AUTOINCREMENT, failure_code TEXT, category TEXT, strategy TEXT, q_value REAL DEFAULT 0.5, platforms TEXT DEFAULT '[]', success_count INTEGER DEFAULT 0, consecutive_failures INTEGER DEFAULT 0, avg_repair_ms REAL DEFAULT 5, conditions TEXT DEFAULT '{}', anti_conditions TEXT DEFAULT '{}', reasoning TEXT)`);
    db.exec(`CREATE TABLE IF NOT EXISTS anti_patterns (id INTEGER PRIMARY KEY AUTOINCREMENT, failure_code TEXT NOT NULL, category TEXT NOT NULL, strategy TEXT NOT NULL, failure_reasoning TEXT, observation_count INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()), UNIQUE(failure_code, category, strategy))`);
    gen = new StrategyGenerator(db);
  });
  afterEach(() => db.close());

  it('analyzeGaps finds anti-patterns', () => {
    db.prepare('INSERT INTO anti_patterns (failure_code, category, strategy, observation_count) VALUES (?,?,?,?)').run('stuck-tx', 'nonce', 'refresh_nonce', 5);
    const gaps = gen.analyzeGaps(2);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].triedStrategies).toContain('refresh_nonce');
  });

  it('analyzeGaps returns empty when no gaps', () => {
    expect(gen.analyzeGaps(100).length).toBe(0);
  });

  it('generates strategy for nonce gap', async () => {
    db.prepare('INSERT INTO anti_patterns (failure_code, category, strategy, observation_count) VALUES (?,?,?,?)').run('nonce-stuck', 'nonce', 'refresh_nonce', 5);
    const s = await gen.generateStrategy(gen.analyzeGaps(1)[0]);
    expect(s).not.toBeNull();
    expect(s!.source).toBe('auto-generated');
  });

  it('generates strategy for gas gap', async () => {
    db.prepare('INSERT INTO anti_patterns (failure_code, category, strategy, observation_count) VALUES (?,?,?,?)').run('gas-issue', 'gas', 'speed_up_transaction', 5);
    const s = await gen.generateStrategy(gen.analyzeGaps(1)[0]);
    expect(s!.overrideKeys).toContain('gasPrice');
  });

  it('validate rejects modifying "to"', () => {
    expect(gen.validate({ name: 'bad', description: 'x', action: 'modify', overrideKeys: ['to'], overrideLogic: 'x', confidence: 0.9, source: 'auto-generated' }).valid).toBe(false);
  });

  it('validate rejects modifying "data"', () => {
    expect(gen.validate({ name: 'bad2', description: 'x', action: 'modify', overrideKeys: ['data'], overrideLogic: 'x', confidence: 0.8, source: 'auto-generated' }).valid).toBe(false);
  });

  it('validate accepts safe strategy', () => {
    expect(gen.validate({ name: 'custom_fix', description: 'x', action: 'modify', overrideKeys: ['gasPrice'], overrideLogic: 'x', confidence: 0.6, source: 'auto-generated' }).valid).toBe(true);
  });

  it('validate rejects built-in duplicate', () => {
    expect(gen.validate({ name: 'refresh_nonce', description: 'x', action: 'modify', overrideKeys: ['nonce'], overrideLogic: 'x', confidence: 0.9, source: 'auto-generated' }).valid).toBe(false);
  });

  it('register stores valid strategy', () => {
    expect(gen.register({ name: 'new_fix', description: 'x', action: 'modify', overrideKeys: ['gasPrice'], overrideLogic: 'x', confidence: 0.7, source: 'auto-generated', gapCode: 'gas' })).toBe(true);
    expect(gen.getStrategies().length).toBe(1);
  });

  it('register rejects invalid', () => {
    expect(gen.register({ name: 'bad3', description: 'x', action: 'modify', overrideKeys: ['to'], overrideLogic: 'x', confidence: 0.9, source: 'auto-generated' })).toBe(false);
  });

  it('deactivate soft-deletes', () => {
    gen.register({ name: 'temp', description: 'x', action: 'retry', overrideKeys: [], overrideLogic: 'x', confidence: 0.5, source: 'auto-generated' });
    gen.deactivate('temp');
    expect(gen.getStrategies(true).length).toBe(0);
    expect(gen.getStrategies(false).length).toBe(1);
  });

  it('runCycle generates from gaps', async () => {
    db.prepare('INSERT INTO anti_patterns (failure_code, category, strategy, observation_count) VALUES (?,?,?,?)').run('test', 'nonce', 'refresh_nonce', 5);
    const r = await gen.runCycle(1);
    expect(r.gapsFound).toBeGreaterThan(0);
    expect(r.generated).toBeGreaterThan(0);
  });
});
