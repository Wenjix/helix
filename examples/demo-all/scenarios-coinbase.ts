import type { DemoScenario } from './scenarios-tempo.js';

export const coinbaseScenarios: DemoScenario[] = [
  { id: 24, name: 'CDP Rate Limited', errorCode: 'rate-limited', errorMessage: 'CDP API: rate_limit_exceeded — too many requests to /v1/wallets endpoint', tag: 'live' },
  { id: 25, name: 'Paymaster Gas Estimation', errorCode: 'payment-insufficient', errorMessage: 'GAS_ESTIMATION_ERROR (-32004): Gas estimation failed for userOperation. Insufficient gas or invalid paymaster signature', tag: 'live' },
  { id: 26, name: 'AA25 Nonce Mismatch', errorCode: 'verification-failed', errorMessage: 'EntryPoint revert: AA25 Invalid account nonce. Expected nonce 12, got 10', tag: 'live' },
  { id: 27, name: 'Per-UserOp Spend Limit', errorCode: 'policy-violation', errorMessage: 'Paymaster policy: rejected due to max per user op spend limit exceeded. Limit: $5.00, Requested: $12.50', tag: 'live' },
  { id: 28, name: 'x402 Insufficient USDC', errorCode: 'payment-insufficient', errorMessage: 'x402 payment failed: insufficient USDC token balance for 402 payment. Required: 0.10 USDC, Available: 0.02 USDC', tag: 'live' },
  { id: 29, name: 'x402 Wrong Network', errorCode: 'token-uninitialized', errorMessage: 'x402 error: wallet connected to wrong network. Payment requires eip155:8453 (Base), wallet on eip155:1 (Ethereum)', tag: 'live' },
  { id: 30, name: 'Malformed Transaction', errorCode: 'malformed-credential', errorMessage: 'CDP API: malformed_transaction — Malformed unsigned transaction. Invalid RLP encoding for EVM transaction', tag: 'live' },
  { id: 31, name: 'Monthly Org Spend Limit', errorCode: 'policy-violation', errorMessage: 'Paymaster policy: rejected due to max monthly org spend limit. Monthly budget exhausted', tag: 'live' },
];
