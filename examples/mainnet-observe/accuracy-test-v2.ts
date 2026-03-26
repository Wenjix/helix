/**
 * Helix Accuracy Test v2 — Full Coverage
 *
 * Tests all platform adapters: Coinbase, Tempo, Privy, Generic
 * Covers: ERC-4337, session, DEX, MPP, policy, cross-chain, edge cases
 *
 * Usage:
 *   export BASE_RPC_URL="..."
 *   export PRIVATE_KEY="0x..."
 *   export RECIPIENT="0x..."
 *   npx tsx examples/mainnet-observe/accuracy-test-v2.ts
 */

const HELIX_URL = process.env.HELIX_URL || 'http://localhost:7842';

// ── Types ────────────────────────────────────────────────
interface TestCase {
  name: string;
  error: string;
  platform: string;
  expectedCode: string;
  expectedStrategy: string;
}

interface Result extends TestCase {
  actualCode: string;
  actualStrategy: string;
  pass: boolean;
}

// ── Diagnose ─────────────────────────────────────────────
async function diagnose(error: string, platform: string) {
  const res = await fetch(`${HELIX_URL}/repair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error, platform }),
  });
  return res.json();
}

// ── Test Cases ───────────────────────────────────────────
const TEST_CASES: TestCase[] = [

  // ══ COINBASE — Basic ══════════════════════════════════
  {
    name: 'CB: nonce too low',
    error: 'nonce too low',
    platform: 'coinbase',
    expectedCode: 'verification-failed',
    expectedStrategy: 'refresh_nonce',
  },
  {
    name: 'CB: nonce too low (Alchemy format)',
    error: 'err: nonce too low: next nonce 47, tx nonce 0 (supplied gas 21000)',
    platform: 'coinbase',
    expectedCode: 'verification-failed',
    expectedStrategy: 'refresh_nonce',
  },
  {
    name: 'CB: insufficient balance (viem format)',
    error: 'The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.',
    platform: 'coinbase',
    expectedCode: 'payment-insufficient',
    expectedStrategy: 'reduce_request',
  },
  {
    name: 'CB: gas too low',
    error: 'The amount of gas (1) provided for the transaction is too low.',
    platform: 'coinbase',
    expectedCode: 'gas-too-low',
    expectedStrategy: 'speed_up_transaction',
  },
  {
    name: 'CB: replacement underpriced',
    error: 'replacement transaction underpriced',
    platform: 'coinbase',
    expectedCode: 'gas-underpriced',
    expectedStrategy: 'speed_up_transaction',
  },
  {
    name: 'CB: intrinsic gas too low',
    error: 'intrinsic gas too low',
    platform: 'coinbase',
    expectedCode: 'gas-too-low',
    expectedStrategy: 'speed_up_transaction',
  },

  // ══ COINBASE — ERC-4337 / Account Abstraction ═════════
  {
    name: 'CB: AA25 invalid account nonce',
    error: 'AA25 invalid account nonce',
    platform: 'coinbase',
    expectedCode: 'nonce-conflict',
    expectedStrategy: 'refresh_nonce',
  },
  {
    name: 'CB: AA21 didn\'t pay prefund',
    error: 'AA21 didn\'t pay prefund',
    platform: 'coinbase',
    expectedCode: 'payment-insufficient',
    expectedStrategy: 'reduce_request',
  },
  {
    name: 'CB: GAS_ESTIMATION_ERROR',
    error: 'GAS_ESTIMATION_ERROR: failed to estimate gas',
    platform: 'coinbase',
    expectedCode: 'gas-estimation-failed',
    expectedStrategy: 'speed_up_transaction',
  },
  {
    name: 'CB: paymaster balance low',
    error: 'paymaster deposit too low',
    platform: 'coinbase',
    expectedCode: 'paymaster-balance-low',
    expectedStrategy: 'reduce_request',
  },
  {
    name: 'CB: x402 payment required',
    error: 'x402 payment required',
    platform: 'coinbase',
    expectedCode: 'x402-required',
    expectedStrategy: 'switch_network',
  },

  // ══ COINBASE — Rate Limit ═════════════════════════════
  {
    name: 'CB: 429 rate limit',
    error: '429 Too Many Requests',
    platform: 'coinbase',
    expectedCode: 'rate-limited',
    expectedStrategy: 'backoff_retry',
  },
  {
    name: 'CB: rate limit exceeded',
    error: 'Request rate exceeded (429)',
    platform: 'coinbase',
    expectedCode: 'rate-limited',
    expectedStrategy: 'backoff_retry',
  },

  // ══ COINBASE — Network ════════════════════════════════
  {
    name: 'CB: wrong network',
    error: 'network_connection_failed',
    platform: 'coinbase',
    expectedCode: 'server-error',
    expectedStrategy: 'retry',
  },

  // ══ TEMPO ═════════════════════════════════════════════
  {
    name: 'Tempo: nonce mismatch',
    error: 'nonce mismatch',
    platform: 'tempo',
    expectedCode: 'nonce-conflict',
    expectedStrategy: 'refresh_nonce',
  },
  {
    name: 'Tempo: session expired',
    error: 'session expired',
    platform: 'tempo',
    expectedCode: 'session-expired',
    expectedStrategy: 'renew_session',
  },
  {
    name: 'Tempo: session token invalid',
    error: 'session token invalid',
    platform: 'tempo',
    expectedCode: 'session-expired',
    expectedStrategy: 'renew_session',
  },
  {
    name: 'Tempo: MPP balance insufficient',
    error: 'MPP balance insufficient',
    platform: 'tempo',
    expectedCode: 'payment-insufficient',
    expectedStrategy: 'reduce_request',
  },
  {
    name: 'Tempo: DEX slippage exceeded',
    error: 'slippage tolerance exceeded',
    platform: 'tempo',
    expectedCode: 'swap-reverted',
    expectedStrategy: 'split_swap',
  },
  {
    name: 'Tempo: gas spike',
    error: 'gas price spike detected',
    platform: 'tempo',
    expectedCode: 'gas-spike',
    expectedStrategy: 'speed_up_transaction',
  },
  {
    name: 'Tempo: rate limit',
    error: 'rate limit exceeded',
    platform: 'tempo',
    expectedCode: 'rate-limited',
    expectedStrategy: 'backoff_retry',
  },

  // ══ PRIVY ═════════════════════════════════════════════
  {
    name: 'Privy: policy violation',
    error: 'policy violation',
    platform: 'privy',
    expectedCode: 'policy-violation',
    expectedStrategy: 'split_transaction',
  },
  {
    name: 'Privy: gas limit exceeded',
    error: 'gas limit exceeded',
    platform: 'privy',
    expectedCode: 'gas-limit-exceeded',
    expectedStrategy: 'speed_up_transaction',
  },
  {
    name: 'Privy: cross-chain bridge failed',
    error: 'cross-chain bridge failed',
    platform: 'privy',
    expectedCode: 'wrong-network',
    expectedStrategy: 'switch_network',
  },
  {
    name: 'Privy: embedded wallet locked',
    error: 'embedded wallet locked',
    platform: 'privy',
    expectedCode: 'wallet-locked',
    expectedStrategy: 'renew_session',
  },
  {
    name: 'Privy: insufficient funds',
    error: 'insufficient funds',
    platform: 'privy',
    expectedCode: 'payment-insufficient',
    expectedStrategy: 'reduce_request',
  },

  // ══ GENERIC ═══════════════════════════════════════════
  {
    name: 'Generic: 429',
    error: '429',
    platform: 'generic',
    expectedCode: 'rate-limited',
    expectedStrategy: 'backoff_retry',
  },
  {
    name: 'Generic: 500 server error',
    error: 'Internal Server Error 500',
    platform: 'generic',
    expectedCode: 'server-error',
    expectedStrategy: 'retry',
  },
  {
    name: 'Generic: timeout',
    error: 'request timeout',
    platform: 'generic',
    expectedCode: 'timeout',
    expectedStrategy: 'backoff_retry',
  },

  // ══ EDGE CASES ════════════════════════════════════════
  {
    name: 'Edge: empty string',
    error: '',
    platform: 'coinbase',
    expectedCode: 'unknown',
    expectedStrategy: 'retry',
  },
  {
    name: 'Edge: completely unknown error',
    error: 'ZXQY_UNKNOWN_ERROR_XYZ_12345',
    platform: 'coinbase',
    expectedCode: 'unknown',
    expectedStrategy: 'retry',
  },
  {
    name: 'Edge: multiple keywords (nonce + gas)',
    error: 'nonce too low and gas estimation failed',
    platform: 'coinbase',
    expectedCode: 'verification-failed',
    expectedStrategy: 'refresh_nonce',
  },
];

// ── Runner ────────────────────────────────────────────────
async function main() {
  console.log('\nHelix Accuracy Test v2 — Full Coverage');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Helix:      ${HELIX_URL}`);
  console.log(`Test cases: ${TEST_CASES.length}`);
  console.log();

  // Check Helix
  try {
    await fetch(`${HELIX_URL}/health`);
  } catch {
    console.error('❌ Helix server not running.');
    console.error('   node packages/core/dist/cli.js serve --port 7842 --mode observe');
    process.exit(1);
  }

  const results: Result[] = [];
  const platforms = [...new Set(TEST_CASES.map(t => t.platform))];

  for (const platform of platforms) {
    const cases = TEST_CASES.filter(t => t.platform === platform);
    console.log(`── ${platform.toUpperCase()} (${cases.length} tests) ${'─'.repeat(30)}\n`);

    for (const tc of cases) {
      const d = await diagnose(tc.error, tc.platform);
      const actualCode = d?.failure?.code || 'unknown';
      const actualStrategy = d?.strategy?.name || 'none';
      const pass = actualStrategy === tc.expectedStrategy;

      results.push({ ...tc, actualCode, actualStrategy, pass });

      console.log(`  ${pass ? '✅' : '❌'} ${tc.name}`);
      if (!pass) {
        console.log(`     Error:    "${tc.error.substring(0, 70)}"`);
        console.log(`     Got:      ${actualCode} → ${actualStrategy}`);
        console.log(`     Expected: ${tc.expectedCode} → ${tc.expectedStrategy}`);
      }
    }
    console.log();
  }

  // ── Summary ──────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const accuracy = ((passed / results.length) * 100).toFixed(1);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${passed}/${results.length} passed`);
  console.log(`Accuracy: ${accuracy}%`);
  console.log();

  // Per-platform breakdown
  console.log('Per-platform:');
  for (const platform of platforms) {
    const pr = results.filter(r => r.platform === platform);
    const pp = pr.filter(r => r.pass).length;
    console.log(`  ${platform.padEnd(10)} ${pp}/${pr.length} (${((pp/pr.length)*100).toFixed(0)}%)`);
  }
  console.log();

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ [${r.platform}] ${r.name}`);
      console.log(`     Got:      ${r.actualCode} → ${r.actualStrategy}`);
      console.log(`     Expected: ${r.expectedCode} → ${r.expectedStrategy}`);
    });
  }
}

main().catch(console.error);
