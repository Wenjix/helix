import { describe, it, expect } from 'vitest';
import { HelixProvider } from '../src/engine/provider.js';
import type { FailureClassification } from '../src/engine/types.js';

function makeFailure(overrides: Partial<FailureClassification> = {}): FailureClassification {
  return {
    code: 'payment-insufficient', category: 'balance', severity: 'high',
    platform: 'tempo', details: 'test', timestamp: Date.now(),
    ...overrides,
  };
}

describe('HelixProvider', () => {
  // Default provider with no config = mock/dev mode (allows everything)
  const provider = new HelixProvider({});
  // Restricted provider with explicit config
  const restrictedProvider = new HelixProvider({ rpcUrl: 'https://rpc.test.com' });

  it('executes backoff_retry without provider config', async () => {
    const result = await provider.execute('backoff_retry',
      makeFailure({ code: 'rate-limited', category: 'auth', platform: 'generic' }),
      { retryAfter: 0.1 });
    expect(result.success).toBe(true);
    expect(result.description).toContain('Waited');
  });

  it('executes reduce_request with available balance', async () => {
    const result = await provider.execute('reduce_request',
      makeFailure(),
      { availableBalance: 50 });
    expect(result.success).toBe(true);
    expect(result.overrides.amount).toBe(50);
  });

  it('executes fix_params filling missing fields', async () => {
    const result = await provider.execute('fix_params',
      makeFailure({ code: 'malformed-credential', category: 'service', platform: 'privy' }),
      {});
    expect(result.success).toBe(true);
    expect(result.overrides.gasLimit).toBe('21000');
    expect(result.overrides.chainId).toBe(1);
    expect(result.overrides.type).toBe(2);
  });

  it('mock-executes refresh_nonce in dev mode (no explicit config)', async () => {
    const result = await provider.execute('refresh_nonce',
      makeFailure({ code: 'verification-failed', category: 'signature' }),
      {});
    expect(result.success).toBe(true);
    expect(result.description).toContain('MOCK');
  });

  it('fails refresh_nonce with explicit config but no rpcUrl', async () => {
    const privyOnly = new HelixProvider({ privy: { appId: 'x', appSecret: 'y' } });
    const result = await privyOnly.execute('refresh_nonce',
      makeFailure({ code: 'verification-failed', category: 'signature' }),
      {});
    expect(result.success).toBe(false);
    expect(result.description).toContain('No RPC URL');
  });

  it('succeeds refresh_nonce with rpcUrl', async () => {
    const rpcProvider = new HelixProvider({ rpcUrl: 'https://rpc.test.com' });
    const result = await rpcProvider.execute('refresh_nonce',
      makeFailure({ code: 'verification-failed', category: 'signature' }),
      { chainNonce: 42 });
    expect(result.success).toBe(true);
    expect(result.overrides.nonce).toBe(42);
  });

  it('executes switch_network with rpcUrl', async () => {
    const rpcProvider = new HelixProvider({ rpcUrl: 'https://rpc.test.com' });
    const result = await rpcProvider.execute('switch_network',
      makeFailure({ code: 'token-uninitialized', category: 'network' }),
      { targetChainId: 42069 });
    expect(result.success).toBe(true);
    expect(result.overrides.chainId).toBe(42069);
  });

  it('executes hold_and_notify', async () => {
    const result = await provider.execute('hold_and_notify',
      makeFailure({ code: 'offramp-failed', category: 'offramp' }),
      {});
    expect(result.success).toBe(true);
    expect(result.overrides.paused).toBe(true);
  });

  it('mock-executes unimplemented strategies', async () => {
    const result = await provider.execute('swap_currency',
      makeFailure(),
      {});
    expect(result.success).toBe(true);
    expect(result.description).toContain('MOCK');
  });

  describe('canExecute', () => {
    it('returns true for no-provider strategies', () => {
      expect(provider.canExecute('backoff_retry')).toBe(true);
      expect(provider.canExecute('retry')).toBe(true);
      expect(provider.canExecute('reduce_request')).toBe(true);
      expect(provider.canExecute('fix_params')).toBe(true);
    });

    it('allows all strategies in mock/dev mode (no explicit config)', () => {
      expect(provider.canExecute('refresh_nonce')).toBe(true);
      expect(provider.canExecute('swap_currency')).toBe(true);
    });

    it('returns false for rpc strategies without rpcUrl when config is explicit', () => {
      // Has privy config but no rpcUrl — restrictive mode
      const privyOnly = new HelixProvider({ privy: { appId: 'x', appSecret: 'y' } });
      expect(privyOnly.canExecute('refresh_nonce')).toBe(false);
      expect(privyOnly.canExecute('switch_network')).toBe(false);
    });

    it('returns true for rpc strategies with rpcUrl', () => {
      expect(restrictedProvider.canExecute('refresh_nonce')).toBe(true);
      expect(restrictedProvider.canExecute('switch_network')).toBe(true);
    });

    it('returns false for chain-write strategies without privateKey', () => {
      expect(restrictedProvider.canExecute('swap_currency')).toBe(false);
    });

    it('returns true for chain-write strategies with privateKey', () => {
      const fullProvider = new HelixProvider({ rpcUrl: 'https://rpc.test.com', privateKey: '0xabc' });
      expect(fullProvider.canExecute('swap_currency')).toBe(true);
    });
  });
});
