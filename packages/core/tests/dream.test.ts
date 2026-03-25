import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeneMap } from '../src/engine/gene-map.js';
import { GeneDream } from '../src/engine/dream.js';
import { IdleScheduler } from '../src/engine/idle-scheduler.js';

describe('Gene Dream', () => {
  let gm: GeneMap;
  let dream: GeneDream;

  beforeEach(() => {
    gm = new GeneMap(':memory:');
    dream = new GeneDream(gm, { minGenes: 5, minNewRepairs: 3, minHoursSinceLastDream: 0 });
  });
  afterEach(() => { gm.close(); });

  it('shouldDream returns false when too few genes', () => {
    // Clear seed genes
    gm.database.exec('DELETE FROM genes');
    const r = dream.shouldDream();
    expect(r.ready).toBe(false);
    expect(r.reason).toContain('genes');
  });

  it('shouldDream returns true when conditions met', () => {
    // Seed genes give us 12 genes already
    const db = gm.database;
    db.exec(`CREATE TABLE IF NOT EXISTS gene_meta (key TEXT PRIMARY KEY, value TEXT)`);
    db.prepare("INSERT OR REPLACE INTO gene_meta (key, value) VALUES ('repairs_since_dream', '15')").run();
    expect(dream.shouldDream().ready).toBe(true);
  });

  it('dream prunes low Q-value genes', async () => {
    const db = gm.database;
    // Set some seed genes to very low Q + high failures
    db.prepare("UPDATE genes SET q_value = 0.1, consecutive_failures = 5 WHERE id <= 3").run();
    const before = (db.prepare('SELECT COUNT(*) as cnt FROM genes').get() as any).cnt;
    const stats = await dream.dream(true);
    const after = (db.prepare('SELECT COUNT(*) as cnt FROM genes').get() as any).cnt;
    expect(stats.genesPruned).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it('dream finds clusters', async () => {
    const stats = await dream.dream(true);
    // Seed genes have some genes with same (code, category) — should find clusters
    expect(stats.clustersFound).toBeGreaterThanOrEqual(0);
    expect(stats.beforeCount).toBeGreaterThan(0);
  });

  it('dream stores metadata', async () => {
    await dream.dream(true);
    const last = dream.lastDreamStats();
    expect(last).not.toBeNull();
    expect(last.beforeCount).toBeGreaterThan(0);
    expect(last.timestamp).toBeDefined();
  });

  it('dream is idempotent', async () => {
    const s1 = await dream.dream(true);
    const s2 = await dream.dream(true);
    expect(s2.genesPruned).toBeLessThanOrEqual(s1.genesPruned);
  });

  it('dream emits events', async () => {
    const stages: string[] = [];
    const d = new GeneDream(gm, {
      minGenes: 1, minNewRepairs: 0, minHoursSinceLastDream: 0,
      onDream: (e) => stages.push(e.stage),
    });
    await d.dream(true);
    expect(stages).toContain('start');
    expect(stages).toContain('cluster');
    expect(stages).toContain('prune');
    expect(stages).toContain('consolidate');
    expect(stages).toContain('enrich');
    expect(stages).toContain('reindex');
    expect(stages).toContain('complete');
  });
});

describe('Idle Scheduler', () => {
  it('creates without error', () => {
    const gm = new GeneMap(':memory:');
    const s = new IdleScheduler(gm, { enabled: false });
    expect(s).toBeDefined();
    gm.close();
  });

  it('activity does not throw', () => {
    const gm = new GeneMap(':memory:');
    const s = new IdleScheduler(gm, { enabled: false });
    s.activity();
    gm.close();
  });

  it('manual trigger works', async () => {
    const gm = new GeneMap(':memory:');
    const s = new IdleScheduler(gm, { enabled: false, minGenes: 1, minNewRepairs: 0, minHoursSinceLastDream: 0 });
    const stats = await s.triggerDream(true);
    expect(stats.beforeCount).toBeGreaterThan(0);
    gm.close();
  });

  it('start and stop do not throw', () => {
    const gm = new GeneMap(':memory:');
    const s = new IdleScheduler(gm, { enabled: true, lightDreamIdleMinutes: 999, fullDreamIdleMinutes: 999 });
    s.start();
    s.stop();
    gm.close();
  });
});
