import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { checkConditions, getConditionMultiplier, updateGeneConditions } from '../src/engine/conditional-genes.js';

describe('Conditional Genes', () => {
  it('empty conditions always pass', () => {
    expect(checkConditions({}, { platform: 'coinbase' })).toBe(true);
  });
  it('min constraint', () => {
    expect(checkConditions({ gasPrice: { min: 100 } }, { gasPrice: 150 })).toBe(true);
    expect(checkConditions({ gasPrice: { min: 100 } }, { gasPrice: 50 })).toBe(false);
  });
  it('max constraint', () => {
    expect(checkConditions({ gasPrice: { max: 100 } }, { gasPrice: 50 })).toBe(true);
    expect(checkConditions({ gasPrice: { max: 100 } }, { gasPrice: 150 })).toBe(false);
  });
  it('in constraint', () => {
    expect(checkConditions({ platform: { in: ['coinbase', 'tempo'] } }, { platform: 'coinbase' })).toBe(true);
    expect(checkConditions({ platform: { in: ['coinbase', 'tempo'] } }, { platform: 'privy' })).toBe(false);
  });
  it('range constraint', () => {
    expect(checkConditions({ timeOfDay: { range: [0, 6] } }, { timeOfDay: 3 })).toBe(true);
    expect(checkConditions({ timeOfDay: { range: [0, 6] } }, { timeOfDay: 14 })).toBe(false);
  });
  it('unknown context key skipped', () => {
    expect(checkConditions({ gasPrice: { max: 100 } }, {})).toBe(true);
  });
  it('no conditions returns 1.0', () => {
    expect(getConditionMultiplier('{}', '{}', { platform: 'coinbase' })).toBe(1.0);
  });
  it('anti_conditions match returns 0.3', () => {
    expect(getConditionMultiplier('{}', JSON.stringify({ gasPrice: { min: 100 } }), { gasPrice: 150 })).toBe(0.3);
  });
  it('conditions not met returns 0.5', () => {
    expect(getConditionMultiplier(JSON.stringify({ platform: { in: ['coinbase'] } }), '{}', { platform: 'privy' })).toBe(0.5);
  });
  it('conditions met returns 1.0', () => {
    expect(getConditionMultiplier(JSON.stringify({ platform: { in: ['coinbase'] } }), '{}', { platform: 'coinbase' })).toBe(1.0);
  });
  it('anti overrides conditions', () => {
    expect(getConditionMultiplier(JSON.stringify({ platform: { in: ['coinbase'] } }), JSON.stringify({ gasPrice: { min: 100 } }), { platform: 'privy', gasPrice: 150 })).toBe(0.3);
  });
});

describe('updateGeneConditions', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE genes (id INTEGER PRIMARY KEY, failure_code TEXT, strategy TEXT, conditions TEXT DEFAULT '{}', anti_conditions TEXT DEFAULT '{}')`);
    db.prepare("INSERT INTO genes (id, failure_code, strategy) VALUES (1, 'test', 'retry')").run();
  });
  afterEach(() => db.close());

  it('success updates conditions', () => {
    updateGeneConditions(db, 1, { platform: 'coinbase', gasPrice: 50 }, true);
    const conds = JSON.parse((db.prepare('SELECT conditions FROM genes WHERE id = 1').get() as any).conditions);
    expect(conds.platform.in).toContain('coinbase');
  });
  it('failure updates anti_conditions', () => {
    updateGeneConditions(db, 1, { platform: 'privy', gasPrice: 200 }, false);
    const anti = JSON.parse((db.prepare('SELECT anti_conditions FROM genes WHERE id = 1').get() as any).anti_conditions);
    expect(Object.keys(anti).length).toBeGreaterThan(0);
  });
});
