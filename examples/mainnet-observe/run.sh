#!/bin/bash
# Helix Mainnet Observe — agent + monitor
set -e
echo -e "\n  Helix Mainnet Observe Mode\n  ==========================\n"
if [ -z "$BASE_RPC_URL" ]; then echo "  ✗ BASE_RPC_URL not set"; exit 1; fi
echo "  ✓ BASE_RPC_URL set"
echo "  Starting Helix server..."
npx helix serve --port 7842 --mode observe > helix-server.log 2>&1 &
HELIX_PID=$!; sleep 3
if ! curl -s http://localhost:7842/health > /dev/null; then echo "  ✗ Helix failed"; cat helix-server.log; exit 1; fi
echo "  ✓ Helix on :7842"
echo "  Starting monitor..."
npx tsx monitor.ts > monitor.log 2>&1 &
MONITOR_PID=$!; echo "  ✓ Monitor (PID: $MONITOR_PID)"
if [ -n "$PRIVATE_KEY" ] && [ -n "$RECIPIENT" ]; then
  echo "  Starting agent..."
  INTERVAL_MS=300000 npx tsx agent.ts > agent.log 2>&1 &
  AGENT_PID=$!; echo "  ✓ Agent (PID: $AGENT_PID)"
else echo "  ℹ Agent skipped (no PRIVATE_KEY)"; fi
echo -e "\n  Dashboard: http://localhost:7842/dashboard"
echo -e "  Stop: kill $HELIX_PID $MONITOR_PID ${AGENT_PID:-}\n"
wait
