/**
 * Auto Strategy Generation — LLM + rule-based strategy creation.
 * Analyzes gaps → generates → validates → registers.
 */
import type Database from 'better-sqlite3';
import { SafetyVerifier } from './safety-verifier.js';

export interface StrategyGap { failureCode: string; category: string; failureCount: number; triedStrategies: string[]; errorSamples: string[] }
export interface GeneratedStrategy { name: string; description: string; action: 'retry' | 'modify' | 'escalate'; overrideKeys: string[]; overrideLogic: string; confidence: number; source: 'auto-generated'; validatedAt?: number; validationScore?: number; gapCode?: string }
export interface ValidationResult { valid: boolean; safetyPassed: boolean; reason?: string }

const EXISTING = ['backoff_retry','retry','retry_with_receipt','refresh_nonce','speed_up_transaction','reduce_request','renew_session','split_transaction','remove_and_resubmit','switch_network','fix_params','switch_endpoint','self_pay_gas','swap_currency','split_swap','hold_and_notify','switch_stablecoin'];

export class StrategyGenerator {
  private db: Database.Database;
  private sv: SafetyVerifier;

  constructor(db: Database.Database) {
    this.db = db;
    this.sv = new SafetyVerifier();
    db.exec(`CREATE TABLE IF NOT EXISTS generated_strategies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT NOT NULL, action TEXT NOT NULL, override_keys TEXT DEFAULT '[]', override_logic TEXT NOT NULL, confidence REAL DEFAULT 0, gap_code TEXT, validation_score REAL, validated_at INTEGER, active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()))`);
  }

  analyzeGaps(minFailures = 2): StrategyGap[] {
    const gapMap = new Map<string, StrategyGap>();
    try {
      const aps = this.db.prepare('SELECT failure_code, category, strategy, observation_count FROM anti_patterns ORDER BY observation_count DESC').all() as any[];
      for (const ap of aps) {
        const k = `${ap.failure_code}:${ap.category}`;
        if (!gapMap.has(k)) gapMap.set(k, { failureCode: ap.failure_code, category: ap.category, failureCount: 0, triedStrategies: [], errorSamples: [] });
        const g = gapMap.get(k)!;
        g.failureCount += ap.observation_count;
        if (!g.triedStrategies.includes(ap.strategy)) g.triedStrategies.push(ap.strategy);
      }
    } catch {}
    try {
      const weak = this.db.prepare('SELECT failure_code, category, strategy, consecutive_failures as fc, q_value FROM genes WHERE consecutive_failures >= ? AND q_value < 0.4 ORDER BY consecutive_failures DESC').all(minFailures) as any[];
      for (const w of weak) {
        const k = `${w.failure_code}:${w.category}`;
        if (!gapMap.has(k)) gapMap.set(k, { failureCode: w.failure_code, category: w.category, failureCount: w.fc, triedStrategies: [w.strategy], errorSamples: [] });
        else { const g = gapMap.get(k)!; g.failureCount = Math.max(g.failureCount, w.fc); if (!g.triedStrategies.includes(w.strategy)) g.triedStrategies.push(w.strategy); }
      }
    } catch {}
    for (const [, g] of gapMap) { g.errorSamples = [`${g.failureCode}: ${g.category}`]; }
    return [...gapMap.values()].filter(g => g.failureCount >= minFailures).sort((a, b) => b.failureCount - a.failureCount);
  }

  async generateStrategy(gap: StrategyGap): Promise<GeneratedStrategy | null> {
    return this.ruleBasedGenerate(gap);
  }

  private ruleBasedGenerate(gap: StrategyGap): GeneratedStrategy | null {
    const tried = new Set(gap.triedStrategies);
    const ts = Date.now() % 10000;
    if (gap.category === 'nonce' && tried.has('refresh_nonce')) return { name: `delayed_nonce_reset_${ts}`, description: `Clear nonce + 2s delay (for ${gap.failureCode})`, action: 'modify', overrideKeys: ['nonce'], overrideLogic: 'Delete nonce, wait 2s, retry', confidence: 0.5, source: 'auto-generated', gapCode: gap.failureCode };
    if (gap.category === 'gas' && tried.has('speed_up_transaction')) return { name: `aggressive_gas_bump_${ts}`, description: `2x gas (for ${gap.failureCode})`, action: 'modify', overrideKeys: ['gasPrice', 'maxFeePerGas'], overrideLogic: 'Multiply gas by 2.0', confidence: 0.4, source: 'auto-generated', gapCode: gap.failureCode };
    if (gap.category === 'balance' && tried.has('reduce_request')) return { name: `micro_split_${ts}`, description: `Split into 4 parts (for ${gap.failureCode})`, action: 'modify', overrideKeys: ['value', 'amount'], overrideLogic: 'Divide by 4, execute sequentially', confidence: 0.4, source: 'auto-generated', gapCode: gap.failureCode };
    return { name: `delayed_retry_${gap.category}_${ts}`, description: `Wait 3s + retry (for ${gap.failureCode})`, action: 'retry', overrideKeys: [], overrideLogic: 'Wait 3000ms, retry unchanged', confidence: 0.3, source: 'auto-generated', gapCode: gap.failureCode };
  }

  validate(strategy: GeneratedStrategy): ValidationResult {
    if (EXISTING.includes(strategy.name)) return { valid: false, safetyPassed: false, reason: 'Strategy name duplicates built-in strategy' };
    for (const k of strategy.overrideKeys) { if (['to', 'data'].includes(k)) return { valid: false, safetyPassed: false, reason: `Strategy modifies forbidden field: ${k}` }; }
    const mock: Record<string, unknown> = {}; for (const k of strategy.overrideKeys) mock[k] = 'test';
    const sc = this.sv.verify(strategy.name, mock, { mode: 'auto', originalArgs: [], strategy: strategy.name, overrides: mock });
    if (!sc.safe) return { valid: false, safetyPassed: false, reason: `Safety: ${sc.violations.join(', ')}` };
    if (strategy.confidence < 0.1) return { valid: false, safetyPassed: true, reason: 'Confidence < 0.1' };
    return { valid: true, safetyPassed: true };
  }

  register(strategy: GeneratedStrategy): boolean {
    if (!this.validate(strategy).valid) return false;
    this.db.prepare(`INSERT INTO generated_strategies (name, description, action, override_keys, override_logic, confidence, gap_code, validation_score, validated_at) VALUES (?,?,?,?,?,?,?,?,unixepoch()) ON CONFLICT(name) DO UPDATE SET confidence = excluded.confidence, validated_at = unixepoch()`).run(strategy.name, strategy.description, strategy.action, JSON.stringify(strategy.overrideKeys), strategy.overrideLogic, strategy.confidence, strategy.gapCode ?? null, strategy.confidence);
    if (strategy.gapCode) {
      try { this.db.prepare(`INSERT OR IGNORE INTO genes (failure_code, category, strategy, q_value, platforms, reasoning) VALUES (?, 'auto-generated', ?, ?, '["generic"]', ?)`).run(strategy.gapCode, strategy.name, strategy.confidence * 0.5, `Auto: ${strategy.description}`); } catch {}
    }
    return true;
  }

  async runCycle(max = 3): Promise<{ gapsFound: number; generated: number; validated: number; registered: number; strategies: string[] }> {
    const gaps = this.analyzeGaps();
    let generated = 0, validated = 0, registered = 0;
    const names: string[] = [];
    for (const gap of gaps.slice(0, max)) {
      const s = await this.generateStrategy(gap);
      if (!s) continue; generated++;
      if (!this.validate(s).valid) continue; validated++;
      if (this.register(s)) { registered++; names.push(s.name); }
    }
    return { gapsFound: gaps.length, generated, validated, registered, strategies: names };
  }

  getStrategies(activeOnly = true): GeneratedStrategy[] {
    return this.db.prepare(`SELECT * FROM generated_strategies ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY created_at DESC`).all().map((s: any) => ({ name: s.name, description: s.description, action: s.action, overrideKeys: JSON.parse(s.override_keys || '[]'), overrideLogic: s.override_logic, confidence: s.confidence, source: 'auto-generated' as const, validatedAt: s.validated_at, validationScore: s.validation_score, gapCode: s.gap_code }));
  }

  deactivate(name: string): boolean { return this.db.prepare('UPDATE generated_strategies SET active = 0 WHERE name = ?').run(name).changes > 0; }
}
