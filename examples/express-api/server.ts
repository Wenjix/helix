#!/usr/bin/env node
/** Helix Example: Express API Server Protection */
import express from 'express';
import { wrap } from '../../packages/core/src/engine/wrap.js';
import type { WrapOptions } from '../../packages/core/src/engine/types.js';

const app = express();
app.use(express.json());

let callCount = 0;
async function processPayment(orderId: string, amount: number) {
  callCount++;
  if (callCount % 2 === 1) throw new Error('HTTP 500: Payment gateway temporarily unavailable');
  return { orderId, amount, status: 'success', txId: `TX-${Date.now()}` };
}

const safeProcess = wrap(processPayment, { mode: 'auto', agentId: 'express-api', verbose: true, geneMapPath: ':memory:', maxRetries: 2 } as WrapOptions);

app.post('/pay', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const result = await safeProcess(orderId, amount);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message, helix: err._helix?.winner?.strategy });
  }
});

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
  console.log('Test: curl -X POST http://localhost:3000/pay -H "Content-Type: application/json" -d \'{"orderId":"ORD-1","amount":50}\'');
});
