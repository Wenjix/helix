#!/usr/bin/env node
/** Helix Example: Coinbase AgentKit Integration (simulated) */
import { wrap } from '../../packages/core/src/engine/wrap.js';
import type { WrapOptions } from '../../packages/core/src/engine/types.js';

async function agentKitTransfer(params: { to: string; amount: string; asset: string }) {
  throw new Error('AA25 invalid account nonce');
}

const safeTransfer = wrap(agentKitTransfer, { mode: 'observe', agentId: 'agentkit-example', provider: { rpcUrl: 'https://sepolia.base.org' }, verbose: true, geneMapPath: ':memory:' } as WrapOptions);

async function main() {
  try {
    await safeTransfer({ to: '0x123...', amount: '0.1', asset: 'eth' });
  } catch (err: any) {
    if (err._helix) {
      console.log('\nHelix Diagnosis:');
      console.log('  Error:', err._helix.failure?.code);
      console.log('  Fix:', err._helix.winner?.strategy ?? err._helix.gene?.strategy);
      console.log('  Immune:', err._helix.immune);
      console.log('\nTo auto-fix: wrap(fn, { mode: "auto" })');
    }
  }
}
main();
