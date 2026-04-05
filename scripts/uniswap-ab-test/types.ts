export interface SwapAttempt {
  group: 'control' | 'helix';
  scenario: string;
  attempt: number;
  txHash: string | null;
  success: boolean;
  errorMessage: string | null;
  errorType: string | null;
  repairApplied: string | null;
  gasUsedETH: number;
  gasUsedUSD: number;
  amountOutMinimum: string;
  deadline: number;
  amountInETH: string;
  timestamp: string;
}

export interface ScenarioResult {
  scenario: string;
  control: {
    attempts: SwapAttempt[];
    succeeded: boolean;
    totalGasUSD: number;
  };
  helix: {
    attempts: SwapAttempt[];
    succeeded: boolean;
    totalGasUSD: number;
    repairApplied: string | null;
  };
}
