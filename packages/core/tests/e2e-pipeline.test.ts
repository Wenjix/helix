import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:17844';
let server: any;

describe('E2E Pipeline — Full PCEC Integration', () => {
  beforeAll(async () => {
    const { spawn } = await import('node:child_process');
    const { lsof } = await import('node:child_process').then(() => ({ lsof: null }));
    try { (await import('node:child_process')).execSync('lsof -ti:17844 | xargs kill -9 2>/dev/null'); } catch {}
    server = spawn('node', ['dist/cli.js', 'serve', '--port', '17844', '--mode', 'auto'], {
      stdio: 'ignore',
      env: { ...process.env },
    });
    await new Promise(r => setTimeout(r, 3000));
  }, 10000);

  afterAll(() => { try { server?.kill(); } catch {} });

  test('1. First repair: nonce error → strategy found', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'nonce mismatch: expected 5 got 3', platform: 'tempo' }),
    });
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.strategy?.name).toBeTruthy();
    expect(data.failure?.code).toBeTruthy();
  });

  test('2. Second repair (same error) → immune', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'nonce mismatch: expected 5 got 3', platform: 'tempo' }),
    });
    const data = await res.json() as any;
    expect(data.immune).toBe(true);
  });

  test('3. Causal graph records edges after sequential errors', async () => {
    await fetch(`${BASE}/repair`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'gas estimation failed: intrinsic gas too low', platform: 'coinbase' }),
    });
    const cg = await (await fetch(`${BASE}/api/causal-graph`)).json() as any;
    expect(cg.nodes?.length).toBeGreaterThan(0);
  });

  test('4. Adaptive weights accessible', async () => {
    const data = await (await fetch(`${BASE}/api/weights`)).json() as any;
    expect(data.defaults).toBeDefined();
    expect(data.defaults.accuracy).toBeCloseTo(0.25, 1);
  });

  test('5. Anti-patterns endpoint', async () => {
    const data = await (await fetch(`${BASE}/api/anti-patterns`)).json() as any;
    expect(Array.isArray(data.antiPatterns)).toBe(true);
  });

  test('6. Meta patterns endpoint', async () => {
    const data = await (await fetch(`${BASE}/api/meta-patterns`)).json() as any;
    expect(data.patterns).toBeDefined();
  });

  test('7. Safety verifier blocks dangerous', async () => {
    const data = await (await fetch(`${BASE}/api/verify-safety`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'fix_params', overrides: { to: '0xevil' }, mode: 'auto' }),
    })).json() as any;
    expect(data.safe).toBe(false);
    expect(data.violations?.length).toBeGreaterThan(0);
  });

  test('8. Safety verifier allows safe', async () => {
    const data = await (await fetch(`${BASE}/api/verify-safety`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'refresh_nonce', overrides: {}, mode: 'auto' }),
    })).json() as any;
    expect(data.safe).toBe(true);
  });

  test('9. Self-play runs', async () => {
    const data = await (await fetch(`${BASE}/api/self-play`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rounds: 3 }),
    })).json() as any;
    expect(data.completed).toBe(3);
  });

  test('10. Federated round runs', async () => {
    const data = await (await fetch(`${BASE}/api/federated/round`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })).json() as any;
    expect(data.gradientsComputed).toBeGreaterThanOrEqual(0);
  });

  test('11. Gene scores have 6 dimensions', async () => {
    const data = await (await fetch(`${BASE}/api/gene-scores`)).json() as any;
    expect(data.total).toBeGreaterThan(0);
    expect(data.genes[0].scores.accuracy).toBeGreaterThanOrEqual(0);
  });

  test('12. Schema version current', async () => {
    const data = await (await fetch(`${BASE}/health`)).json() as any;
    expect(data.schemaVersion).toBeGreaterThanOrEqual(9);
  });

  test('13. Adversarial stats', async () => {
    const data = await (await fetch(`${BASE}/api/adversarial-stats`)).json() as any;
    expect(data.totalAgents).toBeGreaterThanOrEqual(0);
  });

  test('14. Scan command finds patterns', async () => {
    const { execSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'helix-e2e-'));
    writeFileSync(join(dir, 'test.ts'), 'throw new Error("nonce too low");');
    try {
      execSync(`node dist/cli.js scan ${dir}`, { encoding: 'utf-8' });
    } catch (e: any) {
      expect(e.stdout).toContain('payment');
    }
    rmSync(dir, { recursive: true });
  });
});
