# Helix Benchmark Results

## Setup

- 31 payment failure scenarios
- 4 platforms: Tempo, Coinbase, Privy, Generic
- 97 real transactions on Tempo mainnet
- Total cost: $1.98

## Results

| Method | Recovered | Rate | Notes |
|--------|:---------:|:----:|-------|
| Naive Retry | 7/31 | 22.6% | Blind retry, same strategy for all |
| Error-Specific | 21/31 | 67.7% | Manual per-error handling |
| **Helix PCEC** | **28/31** | **90.3%** | Auto-diagnosis + strategy selection |

## Perceive Accuracy

- With platform adapter: 100% (31/31)
- Without adapter (embedding only): 83.9% (26/31)
- 5 unknowns: 3 correctly flagged as requires-human

## Immune Response

- Median first repair: <10ms
- Median immune (repeat): <1ms
- P99 (includes RPC latency): 100-300ms

## Cross-Platform Gene Transfer

Genes learned on one platform protect agents on others:
- Tempo nonce gene → repairs Coinbase AA25 nonce desync
- Coinbase rate-limit gene → repairs generic HTTP 429

## Run Benchmark

```bash
npx tsx examples/benchmark/baseline-comparison.ts
```
