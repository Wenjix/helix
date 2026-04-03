import { describe, it, expect } from 'vitest';
import { DEFAULT_BETA_CONFIG, isFeatureEnabled, BetaConfig } from '../src/beta/index.js';

describe('Beta Config', () => {
  it('should default to disabled', () => {
    expect(DEFAULT_BETA_CONFIG.enabled).toBe(false);
  });

  it('should not enable features when beta is disabled', () => {
    const config: BetaConfig = { ...DEFAULT_BETA_CONFIG, enabled: false };
    expect(isFeatureEnabled(config, 'vialosEndpoints')).toBe(false);
    expect(isFeatureEnabled(config, 'vialosBranding')).toBe(false);
  });

  it('should enable features when beta is enabled', () => {
    const config: BetaConfig = { ...DEFAULT_BETA_CONFIG, enabled: true };
    expect(isFeatureEnabled(config, 'vialosEndpoints')).toBe(true);
    expect(isFeatureEnabled(config, 'vialosBranding')).toBe(true);
  });

  it('should respect individual feature flags', () => {
    const config: BetaConfig = {
      enabled: true,
      features: { vialosEndpoints: true, vialosBranding: false },
    };
    expect(isFeatureEnabled(config, 'vialosEndpoints')).toBe(true);
    expect(isFeatureEnabled(config, 'vialosBranding')).toBe(false);
  });
});
