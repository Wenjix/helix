import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AdapterDiscovery } from '../src/engine/adapter-discovery.js';

describe('Auto Adapter Discovery', () => {
  let db: Database.Database;
  let disc: AdapterDiscovery;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE IF NOT EXISTS genes (id INTEGER PRIMARY KEY AUTOINCREMENT, failure_code TEXT, category TEXT, strategy TEXT, q_value REAL DEFAULT 0.5, platforms TEXT DEFAULT '[]', success_count INTEGER DEFAULT 0, consecutive_failures INTEGER DEFAULT 0, avg_repair_ms REAL DEFAULT 5, conditions TEXT DEFAULT '{}', anti_conditions TEXT DEFAULT '{}', reasoning TEXT)`);
    db.exec(`CREATE TABLE IF NOT EXISTS self_play_history (id INTEGER PRIMARY KEY AUTOINCREMENT, challenge_id TEXT, error_message TEXT, platform TEXT, difficulty TEXT, mutation_type TEXT, strategy_used TEXT, repaired INTEGER DEFAULT 0, verified INTEGER DEFAULT 0, weakness TEXT, played_at INTEGER DEFAULT (unixepoch()))`);
    disc = new AdapterDiscovery(db);
  });
  afterEach(() => db.close());

  it('returns empty when no unknowns', () => {
    const r = disc.runDiscovery();
    expect(r.unknownErrors).toBe(0);
    expect(r.suggestions.length).toBe(0);
  });

  it('clusters solana errors', () => {
    for (let i = 0; i < 5; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`solana program instruction failed ${i}`, 'unknown', 0.1);
    expect(disc.clusterUnknowns(3).some(c => c.suggestedPlatform === 'solana')).toBe(true);
  });

  it('suggests adapter with 5+ errors', () => {
    for (let i = 0; i < 6; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`solana lamport error ${i}`, 'unknown', 0.1);
    const s = disc.suggestAdapters(5);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].platform).toBe('solana');
  });

  it('skips existing adapters', () => {
    for (let i = 0; i < 10; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`coinbase CDP error ${i}`, 'unknown', 0.1);
    expect(disc.suggestAdapters(3).every(s => s.platform !== 'coinbase')).toBe(true);
  });

  it('no suggestion below threshold', () => {
    db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run('solana error 1', 'unknown', 0.1);
    expect(disc.suggestAdapters(5).length).toBe(0);
  });

  it('draftAdapter creates patterns', () => {
    for (let i = 0; i < 5; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`solana program instruction failed ${i}`, 'unknown', 0.1);
    disc.suggestAdapters(3);
    const d = disc.draftAdapter('solana');
    expect(d).not.toBeNull();
    expect(d!.patterns.length).toBeGreaterThan(0);
  });

  it('draftAdapter returns null for unknown', () => {
    expect(disc.draftAdapter('nonexistent')).toBeNull();
  });

  it('includes self-play weaknesses', () => {
    for (let i = 0; i < 3; i++) db.prepare("INSERT INTO self_play_history (challenge_id, error_message, verified, weakness) VALUES (?,?,?,?)").run(`sp${i}`, `solana rent error ${i}`, 0, 'No strategy');
    expect(disc.runDiscovery().unknownErrors).toBeGreaterThanOrEqual(3);
  });

  it('guesses balance category', () => {
    for (let i = 0; i < 5; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`stripe insufficient funds ${i}`, 'unknown', 0.1);
    disc.suggestAdapters(3);
    const d = disc.draftAdapter('stripe');
    if (d) expect(d.patterns.some(p => p.category === 'balance')).toBe(true);
  });

  it('getDrafts returns stored', () => {
    for (let i = 0; i < 5; i++) db.prepare("INSERT INTO genes (failure_code, category, q_value) VALUES (?,?,?)").run(`arbitrum nitro error ${i}`, 'unknown', 0.1);
    disc.suggestAdapters(3);
    disc.draftAdapter('arbitrum');
    expect(disc.getDrafts().length).toBeGreaterThan(0);
  });
});
