/**
 * PlatformAdapter interface — implement this to add a new domain to Vial.
 *
 * Helix implements this for payment platforms (Coinbase, Tempo, Privy).
 * You can implement it for any domain: API monitoring, DevOps, CI/CD, etc.
 */
export interface VialPlatformAdapter {
  /** Unique platform identifier (e.g., 'coinbase', 'aws', 'kubernetes') */
  name: string;

  /**
   * Classify an error into a failure code + category + suggested strategy.
   * This is the Perceive stage of PCEC.
   */
  perceive(error: Error | string): {
    code: string;
    category: string;
    strategy: string;
    confidence?: number;
  } | null;

  /**
   * Return all known error patterns for this platform.
   * Used for seed genes and documentation.
   */
  getPatterns(): Array<{
    pattern: string | RegExp;
    code: string;
    category: string;
    strategy: string;
  }>;

  /**
   * Optional: available strategies specific to this platform.
   */
  getStrategies?(): Array<{
    name: string;
    description: string;
    action: 'retry' | 'modify' | 'escalate';
  }>;
}

/**
 * Registry for platform adapters.
 */
export class AdapterRegistry {
  private adapters: Map<string, VialPlatformAdapter> = new Map();

  register(adapter: VialPlatformAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): VialPlatformAdapter | undefined {
    return this.adapters.get(name);
  }

  getAll(): VialPlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Try all adapters to classify an error.
   * Returns the first match, or null.
   */
  perceive(error: Error | string, platformHint?: string): {
    code: string;
    category: string;
    strategy: string;
    platform: string;
    confidence?: number;
  } | null {
    // Try hinted platform first
    if (platformHint) {
      const adapter = this.adapters.get(platformHint);
      if (adapter) {
        const result = adapter.perceive(error);
        if (result) return { ...result, platform: platformHint };
      }
    }

    // Try all adapters
    for (const [name, adapter] of this.adapters) {
      if (name === platformHint) continue; // already tried
      const result = adapter.perceive(error);
      if (result) return { ...result, platform: name };
    }

    return null;
  }
}
