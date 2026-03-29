/**
 * Vial Provider — minimal commit/execute interface.
 *
 * Helix provides a full implementation with viem/DEX support.
 * For Vial standalone, strategies produce overrides only (no on-chain execution).
 */
import type { FailureClassification, HelixProviderConfig } from './types.js';

export interface CommitResult {
  success: boolean;
  overrides: Record<string, unknown>;
  description: string;
  txHash?: string;
}

export class HelixProvider {
  constructor(_config?: HelixProviderConfig) {}

  canExecute(_strategy: string): boolean {
    // In Vial standalone, all strategies produce overrides (no chain execution)
    return true;
  }

  async execute(strategy: string, failure: FailureClassification, context?: Record<string, unknown>): Promise<CommitResult> {
    // Default: return overrides based on strategy type
    const overrides: Record<string, unknown> = {};

    switch (strategy) {
      case 'refresh_nonce':
        return { success: true, overrides: {}, description: `MOCK: refresh_nonce for ${failure.code}` };
      case 'reduce_request':
        if (context?.amount) overrides.amount = String(BigInt(context.amount as string) / 2n);
        return { success: true, overrides, description: `MOCK: reduce_request for ${failure.code}` };
      case 'speed_up_transaction':
        return { success: true, overrides: {}, description: `MOCK: speed_up for ${failure.code}` };
      case 'switch_network':
        return { success: true, overrides: {}, description: `MOCK: switch_network for ${failure.code}` };
      case 'fix_params':
        return { success: true, overrides: {}, description: `MOCK: fix_params for ${failure.code}` };
      default:
        return { success: true, overrides: {}, description: `MOCK: ${strategy} for ${failure.code}` };
    }
  }
}
