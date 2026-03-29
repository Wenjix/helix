/**
 * Auto Adapter Discovery — detect capability gaps + draft adapters.
 */
import type Database from 'better-sqlite3';

export interface UnknownCluster { clusterId: string; keywords: string[]; errorSamples: string[]; count: number; suggestedPlatform: string; confidence: number }
export interface AdapterSuggestion { platform: string; confidence: number; reason: string; errorCount: number; topErrors: string[]; keywords: string[] }
export interface AdapterDraft { platform: string; patterns: { pattern: string; code: string; category: string; strategy: string }[]; source: 'auto-discovered'; generatedAt: number }

const SIGS: Record<string, string[]> = {
  solana: ['solana', 'sol', 'program', 'instruction', 'lamport', 'rent', 'anchor'],
  avalanche: ['avalanche', 'avax', 'subnet'], polygon: ['polygon', 'matic', 'mumbai'],
  arbitrum: ['arbitrum', 'arb', 'nitro'], optimism: ['optimism', 'bedrock'],
  base: ['base', 'base-sepolia'], bnb: ['bnb', 'bsc', 'binance'],
  stripe: ['stripe', 'payment_intent', 'charge', 'idempotency_key'],
  square: ['square', 'square_api', 'catalog'], paypal: ['paypal', 'braintree', 'venmo'],
};
const EXISTING = ['tempo', 'coinbase', 'privy', 'generic'];
const STOPS = new Set(['error', 'failed', 'invalid', 'the', 'and', 'for', 'not', 'with']);
const CAT_MAP: Record<string, string[]> = { nonce: ['nonce', 'sequence'], gas: ['gas', 'fee', 'gwei'], balance: ['balance', 'insufficient', 'funds'], 'rate-limited': ['rate', 'limit', '429'], timeout: ['timeout', 'deadline'], auth: ['auth', 'unauthorized', '401'], network: ['network', 'connection'], signature: ['signature', 'sign', 'verify'] };
const STRAT_MAP: Record<string, string> = { nonce: 'refresh_nonce', gas: 'speed_up_transaction', balance: 'reduce_request', 'rate-limited': 'backoff_retry', timeout: 'backoff_retry', auth: 'renew_session', network: 'backoff_retry', signature: 'fix_params' };

export class AdapterDiscovery {
  private db: Database.Database;
  constructor(db: Database.Database) { this.db = db; db.exec(`CREATE TABLE IF NOT EXISTS adapter_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, confidence REAL DEFAULT 0, reason TEXT, error_count INTEGER DEFAULT 0, top_errors TEXT DEFAULT '[]', keywords TEXT DEFAULT '[]', status TEXT DEFAULT 'suggested', created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()), UNIQUE(platform))`); db.exec(`CREATE TABLE IF NOT EXISTS adapter_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, patterns TEXT DEFAULT '[]', source TEXT DEFAULT 'auto-discovered', generated_at INTEGER DEFAULT (unixepoch()))`); }

  private tok(t: string): string[] { return t.toLowerCase().replace(/[^a-z0-9\s\-_]/g, ' ').split(/[\s\-_]+/).filter(x => x.length > 1); }

  private getUnknowns(): { errorMessage: string; code: string; category: string }[] {
    const r: any[] = [];
    try { for (const g of this.db.prepare("SELECT failure_code, category FROM genes WHERE category IN ('unknown','unrecognized','other') OR q_value < 0.2").all() as any[]) r.push({ errorMessage: g.failure_code, code: g.failure_code, category: g.category }); } catch {}
    try { for (const s of this.db.prepare("SELECT error_message FROM self_play_history WHERE verified = 0 AND weakness IS NOT NULL").all() as any[]) r.push({ errorMessage: s.error_message, code: s.error_message.substring(0, 50), category: 'unknown' }); } catch {}
    return r;
  }

  clusterUnknowns(minSize = 3): UnknownCluster[] {
    const errors = this.getUnknowns();
    if (!errors.length) return [];
    const tokenized = errors.map(e => ({ ...e, tokens: new Set(this.tok(e.errorMessage)) }));
    const pc: Record<string, { count: number; errors: string[]; kw: Set<string> }> = {};
    for (const e of tokenized) for (const [p, kws] of Object.entries(SIGS)) { const m = kws.filter(k => e.tokens.has(k)); if (m.length >= 1) { if (!pc[p]) pc[p] = { count: 0, errors: [], kw: new Set }; pc[p].count++; pc[p].errors.push(e.errorMessage); m.forEach(k => pc[p].kw.add(k)); } }
    const clusters: UnknownCluster[] = [];
    for (const [p, d] of Object.entries(pc)) if (d.count >= minSize) clusters.push({ clusterId: `platform_${p}`, keywords: [...d.kw], errorSamples: d.errors.slice(0, 5), count: d.count, suggestedPlatform: p, confidence: Math.min(1, d.count / 10 * (d.kw.size / 3)) });
    const wf: Record<string, { count: number; errors: string[] }> = {};
    for (const e of tokenized) for (const t of e.tokens) { if (STOPS.has(t)) continue; if (!wf[t]) wf[t] = { count: 0, errors: [] }; wf[t].count++; wf[t].errors.push(e.errorMessage); }
    for (const [w, d] of Object.entries(wf).filter(([_, v]) => v.count >= minSize).sort((a, b) => b[1].count - a[1].count).slice(0, 5)) { if (!clusters.some(c => c.keywords.includes(w))) clusters.push({ clusterId: `keyword_${w}`, keywords: [w], errorSamples: d.errors.slice(0, 5), count: d.count, suggestedPlatform: w, confidence: Math.min(1, d.count / 15) }); }
    return clusters.sort((a, b) => b.confidence - a.confidence);
  }

  suggestAdapters(minErrors = 5): AdapterSuggestion[] {
    const suggestions: AdapterSuggestion[] = [];
    for (const c of this.clusterUnknowns(3)) {
      if (EXISTING.includes(c.suggestedPlatform.toLowerCase()) || c.count < minErrors) continue;
      const s: AdapterSuggestion = { platform: c.suggestedPlatform, confidence: c.confidence, reason: `${c.count} unknown errors with "${c.keywords.join(', ')}"`, errorCount: c.count, topErrors: c.errorSamples.slice(0, 3), keywords: c.keywords };
      suggestions.push(s);
      this.db.prepare(`INSERT INTO adapter_suggestions (platform, confidence, reason, error_count, top_errors, keywords) VALUES (?,?,?,?,?,?) ON CONFLICT(platform) DO UPDATE SET confidence = excluded.confidence, reason = excluded.reason, error_count = excluded.error_count, top_errors = excluded.top_errors, updated_at = unixepoch()`).run(s.platform, s.confidence, s.reason, s.errorCount, JSON.stringify(s.topErrors), JSON.stringify(s.keywords));
    }
    return suggestions;
  }

  draftAdapter(platform: string): AdapterDraft | null {
    const s = this.db.prepare('SELECT * FROM adapter_suggestions WHERE platform = ?').get(platform) as any;
    if (!s) return null;
    const errors: string[] = JSON.parse(s.top_errors || '[]');
    const patterns = errors.map((e: string, i: number) => { const t = this.tok(e); const cat = this.guessCat(t); return { pattern: e.substring(0, 80), code: `${platform}-error-${i + 1}`, category: cat, strategy: STRAT_MAP[cat] || 'backoff_retry' }; });
    this.db.prepare('INSERT INTO adapter_drafts (platform, patterns) VALUES (?,?)').run(platform, JSON.stringify(patterns));
    return { platform, patterns, source: 'auto-discovered', generatedAt: Date.now() };
  }

  private guessCat(tokens: string[]): string { for (const [c, kw] of Object.entries(CAT_MAP)) if (kw.some(k => tokens.includes(k))) return c; return 'unknown'; }
  getSuggestions(): AdapterSuggestion[] { return this.db.prepare('SELECT * FROM adapter_suggestions ORDER BY confidence DESC').all().map((s: any) => ({ platform: s.platform, confidence: s.confidence, reason: s.reason, errorCount: s.error_count, topErrors: JSON.parse(s.top_errors || '[]'), keywords: JSON.parse(s.keywords || '[]') })); }
  getDrafts(): AdapterDraft[] { return this.db.prepare('SELECT * FROM adapter_drafts ORDER BY generated_at DESC').all().map((d: any) => ({ platform: d.platform, patterns: JSON.parse(d.patterns || '[]'), source: 'auto-discovered' as const, generatedAt: d.generated_at })); }
  runDiscovery() { const u = this.getUnknowns(); const c = this.clusterUnknowns(3); return { unknownErrors: u.length, clusters: c.length, suggestions: this.suggestAdapters(3) }; }
}
