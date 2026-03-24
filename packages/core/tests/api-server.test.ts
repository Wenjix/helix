import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiServer } from '../src/api-server.js';

const PORT = 17842;
const BASE = `http://localhost:${PORT}`;
let api: Awaited<ReturnType<typeof createApiServer>>;

beforeAll(async () => {
  api = createApiServer({ port: PORT, mode: 'observe', geneMapPath: ':memory:' });
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

describe('REST API Server', () => {
  it('GET /health returns ok', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.uptime).toBeGreaterThan(0);
  });

  it('GET /status returns gene count', async () => {
    const res = await fetch(`${BASE}/status`);
    const data = await res.json() as any;
    expect(data.status).toBe('running');
    expect(data.mode).toBe('observe');
    expect(typeof data.geneCount).toBe('number');
    expect(data.geneCount).toBeGreaterThan(0); // seed genes
  });

  it('GET /genes returns array', async () => {
    const res = await fetch(`${BASE}/genes`);
    const data = await res.json() as any;
    expect(Array.isArray(data.genes)).toBe(true);
    expect(data.total).toBeGreaterThan(0);
    expect(data.genes[0]).toHaveProperty('failureCode');
    expect(data.genes[0]).toHaveProperty('qValue');
  });

  it('POST /repair with valid error returns diagnosis', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'nonce mismatch: expected 0, got 50',
        agentId: 'test-agent',
        platform: 'tempo',
      }),
    });
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.failure).toBeDefined();
    expect(data.failure.code).toBeTruthy();
    expect(data.immune).toBe(true); // seed gene hit
    expect(typeof data.repairMs).toBe('number');
  });

  it('POST /repair with empty body returns 400', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /repair with unknown error returns diagnosis', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'something completely unknown xyz' }),
    });
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.failure.code).toBeDefined();
  });

  it('POST /repair returns strategy with action mapping', async () => {
    const res = await fetch(`${BASE}/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'HTTP 429: Too Many Requests' }),
    });
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    if (data.strategy) {
      expect(data.strategy.name).toBeTruthy();
      expect(data.strategy.action).toBeTruthy();
    }
  });

  it('POST /dream returns not_implemented', async () => {
    const res = await fetch(`${BASE}/dream`, { method: 'POST' });
    const data = await res.json() as any;
    expect(data.status).toBe('not_implemented');
  });

  it('GET /unknown returns 404', async () => {
    const res = await fetch(`${BASE}/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('OPTIONS /repair returns CORS headers', async () => {
    const res = await fetch(`${BASE}/repair`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
