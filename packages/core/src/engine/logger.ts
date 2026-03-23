export interface HelixLogger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFormat = 'pretty' | 'json';

const PRI: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const C = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };

export function createLogger(opts?: { logger?: HelixLogger; logLevel?: LogLevel; logFormat?: LogFormat; verbose?: boolean }): HelixLogger {
  if (opts?.logger) return opts.logger;
  const min = PRI[opts?.logLevel ?? (opts?.verbose ? 'info' : 'warn')];
  const json = opts?.logFormat === 'json';

  const log = (level: 'debug' | 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) => {
    if (PRI[level] < min) return;
    if (json) { console.log(JSON.stringify({ level, msg, ...data, ts: Date.now() })); return; }
    const extra = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`${C[level]}[helix${level === 'info' ? '' : ':' + level}] ${msg}${extra}${C.reset}`);
  };

  return {
    debug: (m, d) => log('debug', m, d),
    info: (m, d) => log('info', m, d),
    warn: (m, d) => log('warn', m, d),
    error: (m, d) => log('error', m, d),
  };
}
