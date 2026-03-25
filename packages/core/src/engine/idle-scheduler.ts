/**
 * Idle Scheduler — Detects agent inactivity and triggers Gene Dream.
 */

import { GeneDream, type DreamConfig, type DreamStats } from './dream.js';
import type { GeneMap } from './gene-map.js';

export interface IdleSchedulerConfig extends DreamConfig {
  lightDreamIdleMinutes?: number;
  fullDreamIdleMinutes?: number;
  enabled?: boolean;
}

export class IdleScheduler {
  private dream: GeneDream;
  private config: IdleSchedulerConfig;
  private lightTimer: ReturnType<typeof setTimeout> | null = null;
  private fullTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(geneMap: GeneMap, config: IdleSchedulerConfig = {}) {
    this.config = {
      lightDreamIdleMinutes: config.lightDreamIdleMinutes ?? 5,
      fullDreamIdleMinutes: config.fullDreamIdleMinutes ?? 30,
      enabled: config.enabled ?? true,
      ...config,
    };
    this.dream = new GeneDream(geneMap, config);
  }

  activity(): void {
    this.resetTimers();
  }

  start(): void {
    if (!this.config.enabled) return;
    this.running = true;
    this.resetTimers();
  }

  stop(): void {
    this.running = false;
    if (this.lightTimer) { clearTimeout(this.lightTimer); this.lightTimer = null; }
    if (this.fullTimer) { clearTimeout(this.fullTimer); this.fullTimer = null; }
  }

  async triggerDream(force = true): Promise<DreamStats> {
    return this.dream.dream(force);
  }

  shouldDream() { return this.dream.shouldDream(); }
  lastDreamStats() { return this.dream.lastDreamStats(); }

  private resetTimers(): void {
    if (!this.running) return;
    if (this.lightTimer) clearTimeout(this.lightTimer);
    if (this.fullTimer) clearTimeout(this.fullTimer);

    this.lightTimer = setTimeout(async () => {
      try { const c = this.dream.shouldDream(); if (c.ready) await this.dream.dream(false); } catch { /* ignore */ }
    }, (this.config.lightDreamIdleMinutes ?? 5) * 60 * 1000);

    this.fullTimer = setTimeout(async () => {
      try { await this.dream.dream(true); } catch { /* ignore */ }
    }, (this.config.fullDreamIdleMinutes ?? 30) * 60 * 1000);
  }
}
