import type { DemoScenario } from './scenarios-tempo.js';

export const privyScenarios: DemoScenario[] = [
  { id: 14, name: 'Policy Spending Limit', errorCode: 'policy-violation', errorMessage: 'Privy policy engine rejected transaction: AMOUNT_EXCEEDS_LIMIT. Policy "max_transfer_500" limits single transfer to 500 USDC. Requested: 2500 USDC', tag: 'live' },
  { id: 15, name: 'Privy Nonce Desync', errorCode: 'verification-failed', errorMessage: 'Transaction nonce mismatch: wallet internal nonce=47 but chain nonce=45. Two pending transactions may be stuck in mempool', tag: 'live' },
  { id: 16, name: 'Privy Gas Sponsor Exhausted', errorCode: 'payment-insufficient', errorMessage: 'Privy automated gas sponsorship balance depleted. Sponsor wallet 0x1234...5678 has 0 USDC. Cannot pay gas for agent transaction', tag: 'mock' },
  { id: 17, name: 'Privy Cross-Chain Mismatch', errorCode: 'token-uninitialized', errorMessage: 'Privy wallet wlt_stu901 is provisioned on Ethereum mainnet but transaction targets Tempo chain (chainId: 42069). Cannot sign for mismatched chain', tag: 'mock' },
  { id: 18, name: 'Privy Insufficient Balance', errorCode: 'payment-insufficient', errorMessage: 'Privy wallet wlt_abc123: insufficient funds for this transaction. Balance: 12.50 USDC, Required: 100.00 USDC + 0.02 USDC gas', tag: 'live' },
  { id: 19, name: 'Privy Broadcast Nonce Conflict', errorCode: 'verification-failed', errorMessage: 'transaction_broadcast_failure: Nonce conflicts or sequencing errors. Transaction was NOT broadcast — safe to retry with corrected nonce', tag: 'live' },
  { id: 20, name: 'Privy Broadcast Invalid Params', errorCode: 'malformed-credential', errorMessage: 'transaction_broadcast_failure: Invalid transaction parameters — malformed data. Missing required field: gas_limit', tag: 'live' },
];
