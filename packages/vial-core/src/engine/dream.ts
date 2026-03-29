/**
 * Gene Dream — Background memory consolidation for Gene Map.
 *
 * Five stages: Cluster → Prune → Consolidate → Enrich → Reindex
 */

import type { GeneMap } from './gene-map.js';

export interface DreamConfig {
  minGenes?: number;
  minHoursSinceLastDream?: number;
  minNewRepairs?: number;
  onDream?: (event: DreamEvent) => void;
}

export interface DreamEvent {
  stage: 'start' | 'cluster' | 'prune' | 'consolidate' | 'enrich' | 'reindex' | 'complete';
  detail?: string;
  stats?: DreamStats;
}

export interface DreamStats {
  clustersFound: number;
  genesPruned: number;
  genesConsolidated: number;
  genesEnriched: number;
  durationMs: number;
  beforeCount: number;
  afterCount: number;
}

export class GeneDream {
  private geneMap: GeneMap;
  private config: Required<Pick<DreamConfig, 'minGenes' | 'minHoursSinceLastDream' | 'minNewRepairs'>> & DreamConfig;
  private dreaming = false;

  constructor(geneMap: GeneMap, config: DreamConfig = {}) {
    this.geneMap = geneMap;
    this.config = {
      minGenes: config.minGenes ?? 20,
      minHoursSinceLastDream: config.minHoursSinceLastDream ?? 24,
      minNewRepairs: config.minNewRepairs ?? 10,
      ...config,
    };
  }

  shouldDream(): { ready: boolean; reason?: string } {
    if (this.dreaming) return { ready: false, reason: 'Already dreaming' };
    const db = this.geneMap.database;
    db.exec(`CREATE TABLE IF NOT EXISTS gene_meta (key TEXT PRIMARY KEY, value TEXT)`);

    const geneCount = (db.prepare('SELECT COUNT(*) as cnt FROM genes').get() as any).cnt;
    if (geneCount < this.config.minGenes) {
      return { ready: false, reason: `Only ${geneCount} genes (need ${this.config.minGenes})` };
    }

    const meta = db.prepare("SELECT value FROM gene_meta WHERE key = 'last_dream_at'").get() as any;
    if (meta) {
      const hoursSince = (Date.now() - Number(meta.value)) / (1000 * 60 * 60);
      if (hoursSince < this.config.minHoursSinceLastDream) {
        return { ready: false, reason: `Last dream ${hoursSince.toFixed(1)}h ago (need ${this.config.minHoursSinceLastDream}h)` };
      }
    }

    const repairsMeta = db.prepare("SELECT value FROM gene_meta WHERE key = 'repairs_since_dream'").get() as any;
    const repairsSinceDream = repairsMeta ? Number(repairsMeta.value) : geneCount;
    if (repairsSinceDream < this.config.minNewRepairs) {
      return { ready: false, reason: `Only ${repairsSinceDream} repairs since last dream (need ${this.config.minNewRepairs})` };
    }

    return { ready: true };
  }

  async dream(force = false): Promise<DreamStats> {
    if (!force) {
      const check = this.shouldDream();
      if (!check.ready) throw new Error(`Dream not ready: ${check.reason}`);
    }

    this.dreaming = true;
    const start = Date.now();
    const db = this.geneMap.database;
    const emit = this.config.onDream ?? (() => {});

    db.exec(`CREATE TABLE IF NOT EXISTS gene_meta (key TEXT PRIMARY KEY, value TEXT)`);
    const beforeCount = (db.prepare('SELECT COUNT(*) as cnt FROM genes').get() as any).cnt;
    let clustersFound = 0, genesPruned = 0, genesConsolidated = 0, genesEnriched = 0;

    try {
      emit({ stage: 'start', detail: `Starting dream with ${beforeCount} genes` });

      // Stage 1: Cluster
      emit({ stage: 'cluster' });
      const clusters = db.prepare(`SELECT failure_code, category, COUNT(*) as cnt, GROUP_CONCAT(id) as gene_ids FROM genes GROUP BY failure_code, category HAVING cnt > 1`).all() as any[];
      clustersFound = clusters.length;

      // Stage 2: Prune
      emit({ stage: 'prune' });
      genesPruned += db.prepare(`DELETE FROM genes WHERE q_value < 0.15 AND consecutive_failures > 3`).run().changes;

      // Stage 3: Consolidate
      emit({ stage: 'consolidate' });
      for (const cluster of clusters) {
        if (cluster.cnt < 3) continue;
        const geneIds = cluster.gene_ids.split(',').map(Number);
        const clusterGenes = db.prepare(`SELECT * FROM genes WHERE id IN (${geneIds.map(() => '?').join(',')})`).all(...geneIds) as any[];
        if (clusterGenes.length <= 1) continue;

        const best = clusterGenes.sort((a: any, b: any) => b.q_value - a.q_value)[0];
        const allPlatforms = [...new Set(clusterGenes.flatMap((g: any) => { try { return JSON.parse(g.platforms || '[]'); } catch { return []; } }))];
        const totalSuccess = clusterGenes.reduce((s: number, g: any) => s + (g.success_count || 0), 0);

        db.prepare(`UPDATE genes SET success_count = ?, platforms = ? WHERE id = ?`).run(totalSuccess, JSON.stringify(allPlatforms), best.id);
        const otherIds = geneIds.filter((id: number) => id !== best.id);
        if (otherIds.length > 0) {
          db.prepare(`DELETE FROM genes WHERE id IN (${otherIds.map(() => '?').join(',')})`).run(...otherIds);
          genesConsolidated += otherIds.length;
        }
      }

      // Stage 4: Enrich
      emit({ stage: 'enrich' });
      const unenriched = db.prepare("SELECT id, failure_code, category FROM genes WHERE platforms IS NULL OR platforms = '[]'").all() as any[];
      for (const gene of unenriched) {
        const related = db.prepare('SELECT DISTINCT platforms FROM genes WHERE failure_code = ? AND category = ? AND id != ?').all(gene.failure_code, gene.category, gene.id) as any[];
        const allP = [...new Set(related.flatMap((r: any) => { try { return JSON.parse(r.platforms || '[]'); } catch { return []; } }))];
        if (allP.length > 0) {
          db.prepare('UPDATE genes SET platforms = ? WHERE id = ?').run(JSON.stringify(allP), gene.id);
          genesEnriched++;
        }
      }

      // Stage 5: Reindex
      emit({ stage: 'reindex' });
      const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM genes').get() as any).cnt;
      const upsertMeta = db.prepare("INSERT INTO gene_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      upsertMeta.run('last_dream_at', String(Date.now()));
      upsertMeta.run('repairs_since_dream', '0');
      upsertMeta.run('last_dream_stats', JSON.stringify({ clustersFound, genesPruned, genesConsolidated, genesEnriched, beforeCount, afterCount, timestamp: new Date().toISOString() }));
      db.exec('ANALYZE');

      const stats: DreamStats = { clustersFound, genesPruned, genesConsolidated, genesEnriched, durationMs: Date.now() - start, beforeCount, afterCount };
      emit({ stage: 'complete', stats, detail: `Dream complete: ${beforeCount} → ${afterCount} genes` });
      return stats;
    } finally {
      this.dreaming = false;
    }
  }

  lastDreamStats(): any {
    try {
      const db = this.geneMap.database;
      db.exec(`CREATE TABLE IF NOT EXISTS gene_meta (key TEXT PRIMARY KEY, value TEXT)`);
      const meta = db.prepare("SELECT value FROM gene_meta WHERE key = 'last_dream_stats'").get() as any;
      return meta ? JSON.parse(meta.value) : null;
    } catch { return null; }
  }
}
