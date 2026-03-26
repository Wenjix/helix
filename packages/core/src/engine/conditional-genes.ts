/**
 * Conditional Genes (ExpeL paper) — strategies scored by context.
 */
import type Database from 'better-sqlite3';

export interface GeneCondition { min?: number; max?: number; in?: (string | number)[]; range?: [number, number] }

export function checkConditions(conditions: Record<string, GeneCondition>, context: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(conditions)) {
    const value = context[key];
    if (value === undefined || value === null) continue;
    if (cond.min !== undefined && typeof value === 'number' && value < cond.min) return false;
    if (cond.max !== undefined && typeof value === 'number' && value > cond.max) return false;
    if (cond.in !== undefined && !cond.in.includes(value as string | number)) return false;
    if (cond.range !== undefined && typeof value === 'number' && (value < cond.range[0] || value > cond.range[1])) return false;
  }
  return true;
}

/** Returns multiplier: 1.0 = match/no conditions, 0.5 = mismatch, 0.3 = anti-match */
export function getConditionMultiplier(geneConditions: string, geneAntiConditions: string, context: Record<string, unknown>): number {
  try {
    const anti = JSON.parse(geneAntiConditions || '{}');
    if (Object.keys(anti).length > 0 && checkConditions(anti, context)) return 0.3;
  } catch {}
  try {
    const conds = JSON.parse(geneConditions || '{}');
    if (Object.keys(conds).length > 0 && !checkConditions(conds, context)) return 0.5;
  } catch {}
  return 1.0;
}

export function updateGeneConditions(db: Database.Database, geneId: number, context: Record<string, unknown>, success: boolean): void {
  const col = success ? 'conditions' : 'anti_conditions';
  const gene = db.prepare(`SELECT ${col} FROM genes WHERE id = ?`).get(geneId) as any;
  if (!gene) return;
  try {
    const existing: Record<string, GeneCondition> = JSON.parse(gene[col] || '{}');
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') {
        if (!existing[key]) existing[key] = { in: [] };
        if (existing[key].in && !existing[key].in!.includes(value)) existing[key].in!.push(value);
      } else if (typeof value === 'number') {
        if (!existing[key]) existing[key] = {};
        if (existing[key].min === undefined || value < existing[key].min!) existing[key].min = value;
        if (existing[key].max === undefined || value > existing[key].max!) existing[key].max = value;
      }
    }
    db.prepare(`UPDATE genes SET ${col} = ? WHERE id = ?`).run(JSON.stringify(existing), geneId);
  } catch {}
}
