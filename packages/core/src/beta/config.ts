export interface BetaConfig {
  enabled: boolean;
  features: {
    vialosEndpoints: boolean;
    vialosBranding: boolean;
  };
}

export const DEFAULT_BETA_CONFIG: BetaConfig = {
  enabled: false,
  features: {
    vialosEndpoints: true,
    vialosBranding: true,
  },
};

export function isFeatureEnabled(config: BetaConfig, feature: keyof BetaConfig['features']): boolean {
  return config.enabled && config.features[feature];
}
