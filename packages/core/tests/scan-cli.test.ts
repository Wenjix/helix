import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('CLI scan command', () => {
  it('exits 0 on clean directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'helix-scan-'));
    writeFileSync(join(dir, 'clean.ts'), 'const x = 1 + 1;');

    const result = execSync(`node packages/core/dist/cli.js scan ${dir}`, { encoding: 'utf-8' });
    expect(result).toContain('No payment error patterns found');

    rmSync(dir, { recursive: true });
  });

  it('exits 1 on directory with payment patterns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'helix-scan-'));
    writeFileSync(join(dir, 'payment.ts'), "throw new Error('nonce too low');");

    try {
      execSync(`node packages/core/dist/cli.js scan ${dir}`, { encoding: 'utf-8' });
      expect.fail('should exit 1');
    } catch (e: any) {
      expect(e.status).toBe(1);
      expect(e.stdout).toContain('payment patterns');
    }

    rmSync(dir, { recursive: true });
  });

  it('--json outputs valid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'helix-scan-'));
    writeFileSync(join(dir, 'pay.ts'), "throw new Error('insufficient funds');");

    try {
      execSync(`node packages/core/dist/cli.js scan ${dir} --json`, { encoding: 'utf-8' });
    } catch (e: any) {
      const parsed = JSON.parse(e.stdout);
      expect(parsed.findings).toBeDefined();
      expect(parsed.summary.total).toBeGreaterThan(0);
    }

    rmSync(dir, { recursive: true });
  });

  it('--format github outputs annotations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'helix-scan-'));
    writeFileSync(join(dir, 'pay.ts'), "throw new Error('rate limit exceeded 429 too many');");

    try {
      execSync(`node packages/core/dist/cli.js scan ${dir} --format github`, { encoding: 'utf-8' });
    } catch (e: any) {
      expect(e.stdout).toContain('::warning');
    }

    rmSync(dir, { recursive: true });
  });
});
