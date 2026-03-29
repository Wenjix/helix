/**
 * DSPy-inspired LLM Prompt Self-Optimization.
 *
 * Paper: DSPy (2310.03714)
 *
 * Tracks LLM classification outcomes and automatically selects
 * the best few-shot examples for the prompt.
 *
 * 100% domain-agnostic — works with any error classification task.
 */

import type Database from 'better-sqlite3';

export interface ClassificationRecord {
  id?: number;
  errorMessage: string;
  predictedCode: string;
  predictedCategory: string;
  predictedStrategy: string;
  actualOutcome: 'correct' | 'incorrect' | 'unknown';
  repairSucceeded?: boolean;
  recordedAt?: number;
}

export interface FewShotExample {
  error: string;
  code: string;
  category: string;
  strategy: string;
}

export class PromptOptimizer {
  private db: Database.Database;
  private maxExamples: number;
  private minRecordsForOptimization: number;

  constructor(db: Database.Database, maxExamples = 5, minRecords = 20) {
    this.db = db;
    this.maxExamples = maxExamples;
    this.minRecordsForOptimization = minRecords;
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS llm_classifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_message TEXT NOT NULL,
      predicted_code TEXT NOT NULL,
      predicted_category TEXT NOT NULL,
      predicted_strategy TEXT NOT NULL,
      actual_outcome TEXT DEFAULT 'unknown',
      repair_succeeded INTEGER,
      recorded_at INTEGER DEFAULT (unixepoch())
    )`);
  }

  /** Record an LLM classification for later evaluation. */
  record(classification: ClassificationRecord): void {
    this.db.prepare(`
      INSERT INTO llm_classifications
        (error_message, predicted_code, predicted_category, predicted_strategy, actual_outcome, repair_succeeded)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      classification.errorMessage,
      classification.predictedCode,
      classification.predictedCategory,
      classification.predictedStrategy,
      classification.actualOutcome,
      classification.repairSucceeded ? 1 : 0,
    );
  }

  /** Update outcome of a previous classification after repair result is known. */
  updateOutcome(errorMessage: string, strategy: string, succeeded: boolean): void {
    this.db.prepare(`
      UPDATE llm_classifications
      SET actual_outcome = ?, repair_succeeded = ?, recorded_at = unixepoch()
      WHERE error_message = ? AND predicted_strategy = ?
      AND actual_outcome = 'unknown'
    `).run(
      succeeded ? 'correct' : 'incorrect',
      succeeded ? 1 : 0,
      errorMessage,
      strategy,
    );
  }

  /**
   * Get the best few-shot examples for the LLM prompt.
   * Selects correct classifications with category diversity.
   */
  getBestExamples(): FewShotExample[] {
    const total = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM llm_classifications',
    ).get() as any).cnt;

    if (total < this.minRecordsForOptimization) return [];

    const examples = this.db.prepare(`
      SELECT error_message, predicted_code, predicted_category, predicted_strategy,
             COUNT(*) as success_count
      FROM llm_classifications
      WHERE actual_outcome = 'correct' AND repair_succeeded = 1
      GROUP BY predicted_code, predicted_category, predicted_strategy
      ORDER BY success_count DESC, recorded_at DESC
      LIMIT ?
    `).all(this.maxExamples * 2) as any[];

    // Ensure category diversity — max 2 examples per category
    const byCategory: Record<string, FewShotExample[]> = {};
    for (const ex of examples) {
      const cat = ex.predicted_category;
      if (!byCategory[cat]) byCategory[cat] = [];
      if (byCategory[cat].length < 2) {
        byCategory[cat].push({
          error: ex.error_message.substring(0, 200),
          code: ex.predicted_code,
          category: ex.predicted_category,
          strategy: ex.predicted_strategy,
        });
      }
    }

    return Object.values(byCategory).flat().slice(0, this.maxExamples);
  }

  /** Build the few-shot section of an LLM prompt. */
  buildFewShotPrompt(): string {
    const examples = this.getBestExamples();
    if (examples.length === 0) return '';

    const lines = examples.map(ex =>
      `Error: "${ex.error}"\n→ code: ${ex.code}, category: ${ex.category}, strategy: ${ex.strategy}`,
    );

    return `\nHere are examples of correctly classified errors:\n\n${lines.join('\n\n')}\n\nUse these as reference for similar patterns.\n`;
  }

  /** Get accuracy statistics. */
  getStats(): {
    total: number;
    correct: number;
    incorrect: number;
    unknown: number;
    accuracy: number;
    examplesAvailable: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as cnt FROM llm_classifications').get() as any).cnt;
    const correct = (this.db.prepare("SELECT COUNT(*) as cnt FROM llm_classifications WHERE actual_outcome = 'correct'").get() as any).cnt;
    const incorrect = (this.db.prepare("SELECT COUNT(*) as cnt FROM llm_classifications WHERE actual_outcome = 'incorrect'").get() as any).cnt;
    const unknown = (this.db.prepare("SELECT COUNT(*) as cnt FROM llm_classifications WHERE actual_outcome = 'unknown'").get() as any).cnt;

    return {
      total,
      correct,
      incorrect,
      unknown,
      accuracy: total > 0 ? Math.round((correct / Math.max(1, correct + incorrect)) * 100) / 100 : 0,
      examplesAvailable: this.getBestExamples().length,
    };
  }

  /** Clear old records (keep last N). */
  prune(keepLast = 500): number {
    const result = this.db.prepare(`
      DELETE FROM llm_classifications
      WHERE id NOT IN (
        SELECT id FROM llm_classifications ORDER BY recorded_at DESC LIMIT ?
      )
    `).run(keepLast);
    return result.changes;
  }
}
