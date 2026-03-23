# Changelog

## [1.2.0] - 2026-03-23

### Added
- **LLM Perceive Fallback**: Unknown errors classified by Claude/GPT when string matching fails
- **LLM Construct Generator**: Suggests repair strategies for errors with no adapter candidates
- **Async Gene Reasoning**: LLM explains WHY strategies work (stored in Gene.reasoning)
- **Gene Telemetry**: Opt-in anonymous reporting of new error discoveries
- **Auto-detect**: `wrap()` recognizes viem-tx, fetch, generic-payment signatures automatically
- **Parameter injection**: Nonce/gas/value auto-corrected on retry (no `parameterModifier` needed)
- **Live Demo**: Multi-agent simulator + On-Call Dashboard (`npm run live`)
- **CLI `explain`**: `npx helix explain "error message"` shows diagnosis + reasoning
- **Structured Logger**: Custom logger support (pino/winston), JSON format, log levels
- **GitHub Actions CI**: Node 18/20/22 matrix
- **4 example projects**: basic-http, viem-transfer, express-api, agentkit
- 174 total tests across 23 files

### Changed
- LLM timeout increased from 2s to 8s for reliability
- Shared Gene Map across demo agents (IMMUNE works properly)
- Perceive patterns expanded for viem nonce error format
- Better error messages with actionable suggestions

### Fixed
- viem nonce error "Nonce provided for the transaction" now correctly classified
- "insufficient funds" pattern now matches (was only "insufficient balance")
- Demo dashboard SSE reconnection with relative URL

## [1.0.0] - 2026-03-22

### Added
- PCEC 6-stage engine (Perceive → Construct → Evaluate → Commit → Verify → Gene)
- Gene Map with Q-value RL scoring, L1 cache, schema versioning v3
- 26 repair strategies with real execution via viem
- 5 platform adapters (Tempo, Privy, Coinbase, Generic HTTP, Stripe)
- 31 failure scenarios, 12 seed genes
- Gene Combine, GC, reasoning, attribution, links
- Root cause hints (13 mappings), Zod validation
- simulate() testing framework, CLI, MCP server, MPP API
- 5 real tx hashes on Base Sepolia
- README, CONTRIBUTING.md, RUNBOOK, MIT license
