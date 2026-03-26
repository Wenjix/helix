/**
 * Meta-Learning Repair — 3+ similar genes with same strategy → learn pattern.
 * New error variants matched instantly without LLM.
 */
import type Database from 'better-sqlite3';

export interface MetaPattern {
  patternId: string;
  keyTokens: string[];
  strategy: string;
  confidence: number;
  exampleCount: number;
  platforms: string[];
  createdAt: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s\-_]/g, ' ').split(/[\s\-_]+/).filter(t => t.length > 1);
}

export class MetaLearner {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS meta_patterns (id INTEGER PRIMARY KEY AUTOINCREMENT, pattern_id TEXT UNIQUE NOT NULL, key_tokens TEXT NOT NULL, strategy TEXT NOT NULL, confidence REAL DEFAULT 0, example_count INTEGER DEFAULT 0, platforms TEXT DEFAULT '[]', created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`);
  }

  findSimilarGenes(errorMsg: string, minSimilarity = 0.25): { id: number; failureCode: string; category: string; strategy: string; qValue: number; platforms: string[]; similarity: number }[] {
    const input = new Set(tokenize(errorMsg));
    if (input.size === 0) return [];
    const genes = this.db.prepare('SELECT id, failure_code, category, strategy, q_value, platforms FROM genes WHERE q_value > 0.2').all() as any[];
    const results: any[] = [];
    for (const g of genes) {
      const gt = new Set(tokenize(g.failure_code));
      if (gt.size === 0) continue;
      const inter = [...input].filter(t => gt.has(t)).length;
      const union = new Set([...input, ...gt]).size;
      const sim = inter / union;
      if (sim >= minSimilarity) {
        let platforms: string[] = []; try { platforms = JSON.parse(g.platforms || '[]'); } catch {}
        results.push({ id: g.id, failureCode: g.failure_code, category: g.category, strategy: g.strategy, qValue: g.q_value, platforms, similarity: sim });
      }
    }
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  learnPattern(errorMsg: string): MetaPattern | null {
    const similar = this.findSimilarGenes(errorMsg);
    if (similar.length < 3) return null;
    const counts: Record<string, number> = {};
    for (const g of similar) counts[g.strategy] = (counts[g.strategy] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 3) return null;

    const [strategy, count] = best;
    const confidence = count / similar.length;
    const tokenSets = similar.filter(g => g.strategy === strategy).map(g => new Set(tokenize(g.failureCode)));
    const common = tokenSets.length > 0 ? [...tokenSets[0]].filter(t => tokenSets.every(s => s.has(t))) : [];
    const allPlatforms = [...new Set(similar.flatMap(g => g.platforms))];
    const patternId = `meta_${common.sort().join('_')}_${strategy}`.substring(0, 100);

    this.db.prepare(`INSERT INTO meta_patterns (pattern_id, key_tokens, strategy, confidence, example_count, platforms) VALUES (?,?,?,?,?,?) ON CONFLICT(pattern_id) DO UPDATE SET confidence = excluded.confidence, example_count = excluded.example_count, platforms = excluded.platforms, updated_at = unixepoch()`).run(patternId, JSON.stringify(common), strategy, confidence, count, JSON.stringify(allPlatforms));
    return { patternId, keyTokens: common, strategy, confidence, exampleCount: count, platforms: allPlatforms, createdAt: Date.now() };
  }

  matchPattern(errorMsg: string): { strategy: string; confidence: number; patternId: string; source: 'meta-learning' } | null {
    const input = new Set(tokenize(errorMsg));
    if (input.size === 0) return null;
    const patterns = this.db.prepare('SELECT * FROM meta_patterns ORDER BY confidence DESC').all() as any[];
    for (const p of patterns) {
      const keys: string[] = JSON.parse(p.key_tokens);
      if (keys.length === 0) continue;
      const ratio = keys.filter(t => input.has(t)).length / keys.length;
      if (ratio >= 0.7) return { strategy: p.strategy, confidence: p.confidence * ratio, patternId: p.pattern_id, source: 'meta-learning' };
    }
    return null;
  }

  getPatterns(): MetaPattern[] {
    return (this.db.prepare('SELECT * FROM meta_patterns ORDER BY confidence DESC').all() as any[]).map(p => ({
      patternId: p.pattern_id, keyTokens: JSON.parse(p.key_tokens), strategy: p.strategy,
      confidence: p.confidence, exampleCount: p.example_count, platforms: JSON.parse(p.platforms), createdAt: p.created_at,
    }));
  }

  learnFromGeneMap(): number {
    const genes = this.db.prepare('SELECT DISTINCT failure_code FROM genes').all() as any[];
    let n = 0;
    for (const g of genes) if (this.learnPattern(g.failure_code)) n++;
    return n;
  }
}
