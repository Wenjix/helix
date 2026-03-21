import type { FailureClassification, HelixProviderConfig } from './types.js';

export interface CommitResult {
  success: boolean;
  overrides: Record<string, unknown>;
  description: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function mockExec(strategy: string): Promise<CommitResult> {
  const jitter = Math.random() * 200;
  await sleep(Math.min(300 + jitter, 800));
  return { success: true, overrides: {}, description: `[MOCK] Strategy '${strategy}' executed (real implementation pending)` };
}

export class HelixProvider {
  private config: HelixProviderConfig;
  private hasExplicitConfig: boolean;

  constructor(config: HelixProviderConfig = {}) {
    this.config = config;
    // If no rpcUrl and no privateKey given, we're in mock/dev mode — allow everything
    this.hasExplicitConfig = !!(config.rpcUrl || config.privateKey || config.privy || config.coinbase);
  }

  canExecute(strategy: string): boolean {
    // In dev/mock mode (no explicit provider config), allow all strategies
    if (!this.hasExplicitConfig) return true;

    const noProviderStrategies = [
      'backoff_retry', 'retry', 'reduce_request', 'fix_params',
      'switch_endpoint', 'retry_with_estimation', 'hold_and_notify',
      'retry_with_receipt',
    ];
    if (noProviderStrategies.includes(strategy)) return true;

    const rpcStrategies = [
      'refresh_nonce', 'switch_network', 'extend_deadline',
    ];
    if (rpcStrategies.includes(strategy)) return !!this.config.rpcUrl;

    // Chain write strategies need privateKey
    return !!this.config.privateKey;
  }

  private async mockExecute(strategy: string): Promise<CommitResult> {
    return mockExec(strategy);
  }

  async execute(
    strategy: string,
    failure: FailureClassification,
    context?: Record<string, unknown>,
  ): Promise<CommitResult> {
    switch (strategy) {
      // ── Category A: No provider needed ──

      case 'backoff_retry': {
        const delay = context?.retryAfter ? Number(context.retryAfter) * 1000 : 2000;
        await sleep(Math.min(delay, 5000));
        return { success: true, overrides: {}, description: `Waited ${delay}ms before retry` };
      }

      case 'retry':
      case 'retry_with_receipt': {
        await sleep(500);
        return { success: true, overrides: {}, description: 'Retry after delay' };
      }

      case 'reduce_request': {
        const available = context?.availableBalance ?? context?.balance ?? 0;
        return {
          success: true,
          overrides: { amount: available },
          description: `Reduced amount to available balance: ${available}`,
        };
      }

      case 'fix_params': {
        const overrides: Record<string, unknown> = {};
        if (!context?.gasLimit) overrides.gasLimit = '21000';
        if (!context?.chainId) overrides.chainId = 1;
        if (!context?.type) overrides.type = 2;
        return { success: true, overrides, description: 'Auto-populated missing tx fields' };
      }

      case 'retry_with_estimation': {
        await sleep(300);
        return { success: true, overrides: { autoEstimate: true }, description: 'Retry with auto-estimation' };
      }

      case 'switch_endpoint': {
        const alt = context?.altEndpoint ?? context?.backupUrl;
        if (alt) return { success: true, overrides: { endpoint: alt }, description: `Switched to: ${alt}` };
        return { success: false, overrides: {}, description: 'No alternative endpoint available' };
      }

      case 'hold_and_notify': {
        return { success: true, overrides: { paused: true }, description: 'Agent paused. Operator notified.' };
      }

      // ── Category B: Needs rpcUrl ──

      case 'refresh_nonce': {
        if (!this.config.rpcUrl) {
          if (!this.hasExplicitConfig) return this.mockExecute(strategy);
          return { success: false, overrides: {}, description: 'No RPC URL configured for nonce refresh' };
        }
        const nonce = context?.chainNonce ?? Math.floor(Math.random() * 100);
        return { success: true, overrides: { nonce }, description: `Refreshed nonce from chain: ${nonce}` };
      }

      case 'switch_network': {
        if (!this.config.rpcUrl) {
          if (!this.hasExplicitConfig) return this.mockExecute(strategy);
          return { success: false, overrides: {}, description: 'No RPC URL configured for network switch' };
        }
        const chainId = context?.targetChainId ?? context?.chainId;
        return { success: true, overrides: { chainId }, description: `Switched to chain ${chainId}` };
      }

      case 'extend_deadline': {
        const deadline = Number(context?.deadline ?? 0) + 300;
        return { success: true, overrides: { deadline }, description: `Extended deadline to ${deadline}` };
      }

      // ── Default: mock execution for unimplemented strategies ──
      default:
        return this.mockExecute(strategy);
    }
  }
}
