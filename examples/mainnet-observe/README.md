# Helix Mainnet Observe Mode

Validate Helix diagnostic accuracy with real Base mainnet data.

## Setup

```bash
npm install @helix-agent/core viem
```

## Option A: Monitor Only (no wallet needed)

```bash
export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
npx helix serve --port 7842 --mode observe &
npx tsx monitor.ts
```

## Option B: Full Agent + Monitor

```bash
export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
export PRIVATE_KEY="0xYOUR_KEY"
export RECIPIENT="0xADDRESS"
bash run.sh
```

## Output

- `diagnosis-log.json` — every diagnosed transaction
- Dashboard: `http://localhost:7842/dashboard`
