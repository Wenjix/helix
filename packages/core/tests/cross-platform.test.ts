import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PcecEngine } from '../src/engine/pcec.js';
import { GeneMap } from '../src/engine/gene-map.js';
import { bus } from '../src/engine/bus.js';
import { defaultAdapters } from '../src/platforms/index.js';

describe('Cross-Platform Immunity', () => {
  let engine: PcecEngine;
  let geneMap: GeneMap;

  beforeEach(() => {
    geneMap = new GeneMap(':memory:');
    engine = new PcecEngine(geneMap, 'xplat-test', { mode: 'auto' });
    for (const adapter of defaultAdapters) engine.registerAdapter(adapter);
    bus.clear();
  });

  afterEach(() => { geneMap.close(); });

  it('Tempo nonce fix immunizes Privy nonce desync', async () => {
    const tempoError = new Error('Transaction signature invalid: nonce mismatch (expected 42, got 41)');
    (tempoError as any).code = 'verification-failed';
    const r1 = await engine.repair(tempoError);
    expect(r1.success).toBe(true);
    expect(r1.immune).toBe(false);

    const privyError = new Error('Transaction nonce mismatch: wallet internal nonce=47 but chain nonce=45');
    const r2 = await engine.repair(privyError);
    expect(r2.success).toBe(true);
    expect(r2.immune).toBe(true);
  });

  it('Tempo balance fix immunizes Privy gas sponsor', async () => {
    const tempoError = new Error('Gas sponsor wallet exhausted — agent cannot submit transactions');
    (tempoError as any).code = 'payment-insufficient';
    await engine.repair(tempoError);

    const privyError = new Error('Privy automated gas sponsorship balance depleted');
    const r2 = await engine.repair(privyError);
    expect(r2.success).toBe(true);
    expect(r2.immune).toBe(true);
  });

  it('Tempo network fix immunizes Privy cross-chain', async () => {
    const tempoError = new Error('Uninitialized token account: USDC not deployed on Tempo testnet');
    (tempoError as any).code = 'token-uninitialized';
    await engine.repair(tempoError);

    const privyError = new Error('Privy wallet wlt_stu901 is provisioned on Ethereum mainnet but transaction targets Tempo chain (chainId: 42069). Cannot sign for mismatched chain');
    const r2 = await engine.repair(privyError);
    expect(r2.success).toBe(true);
    expect(r2.immune).toBe(true);
  });

  it('does NOT cross-immunize unrelated categories', async () => {
    const tempoError = new Error('Payment of 500 USDC failed: insufficient balance');
    (tempoError as any).code = 'payment-insufficient';
    await engine.repair(tempoError);

    const privyError = new Error('Transaction nonce mismatch: wallet internal nonce=47 but chain nonce=45');
    const r2 = await engine.repair(privyError);
    expect(r2.immune).toBe(false);
  });

  it('updates gene platforms array on cross-platform hit', async () => {
    const tempoError = new Error('Uninitialized token account: USDC not deployed on Tempo testnet');
    (tempoError as any).code = 'token-uninitialized';
    await engine.repair(tempoError);

    const privyError = new Error('Privy wallet wlt_stu901 is provisioned on Ethereum mainnet but transaction targets Tempo chain (chainId: 42069). Cannot sign for mismatched chain');
    const r2 = await engine.repair(privyError);
    expect(r2.immune).toBe(true);
    expect(r2.gene!.platforms).toContain('tempo');
    expect(r2.gene!.platforms).toContain('privy');
  });
});
