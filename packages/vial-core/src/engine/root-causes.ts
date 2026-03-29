/**
 * Root cause hints — generic defaults.
 * Helix overrides this with payment-specific root cause mappings.
 */

export interface RootCauseHint {
  likelyCause: string;
  suggestedAction: string;
  isLikelySystematic?: boolean;
  hint?: string;
}

const GENERIC_HINTS: Record<string, RootCauseHint> = {
  'rate-limited': { likelyCause: 'too_many_requests', suggestedAction: 'Implement backoff', hint: 'rate_limit' },
  'server-error': { likelyCause: 'upstream_outage', suggestedAction: 'Retry with backoff', hint: 'server_error' },
  'timeout': { likelyCause: 'slow_response', suggestedAction: 'Increase timeout or retry', hint: 'timeout' },
  'unknown': { likelyCause: 'unclassified', suggestedAction: 'Investigate error message', hint: 'unknown' },
};

export function getRootCause(code: string, _category: string): RootCauseHint | undefined {
  return GENERIC_HINTS[code];
}
