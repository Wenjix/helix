#!/usr/bin/env node
/** Helix Example: Basic HTTP API Protection */
import { wrap } from '../../packages/core/src/engine/wrap.js';
import type { WrapOptions } from '../../packages/core/src/engine/types.js';

let callCount = 0;
async function chargeCustomer(orderId: string, amount: number) {
  callCount++;
  if (callCount === 1) {
    const res = await fetch('https://httpbin.org/status/429');
    throw new Error(`Payment API error: HTTP ${res.status} Rate Limited`);
  }
  const res = await fetch('https://httpbin.org/get');
  const data = await res.json() as { origin: string };
  return { orderId, amount, status: 'charged', origin: data.origin };
}

const safeCharge = wrap(chargeCustomer, { mode: 'auto', agentId: 'basic-http', verbose: true, geneMapPath: ':memory:', maxRetries: 2 } as WrapOptions);

async function main() {
  console.log('Charging customer...');
  try {
    const r = await safeCharge('ORD-001', 29.99);
    console.log('Result:', r);
  } catch (err: any) {
    console.log('Failed:', err.message.slice(0, 60));
    if (err._helix) console.log('Helix suggests:', err._helix.winner?.strategy ?? err._helix.gene?.strategy);
  }
}
main();
