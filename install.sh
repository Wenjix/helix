#!/usr/bin/env bash
# Helix — Self-healing infrastructure for AI agent payments
# Install: curl -sSL https://helix-cnj.pages.dev/install.sh | bash
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; DIM='\033[0;2m'; NC='\033[0m'

echo ""
echo -e "${CYAN}  Helix — Self-healing AI agent payments${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}  ✗ Node.js not found${NC}"
  echo -e "${DIM}    Install: https://nodejs.org (v18+)${NC}"
  exit 1
fi
NODE_V=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_V" -lt 18 ]; then
  echo -e "${RED}  ✗ Node.js 18+ required (found v${NODE_V})${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓${NC} Node.js $(node -v)"

# Install
echo -e "${DIM}  Installing @helix-agent/core...${NC}"
npm install -g @helix-agent/core 2>&1 | tail -1
echo -e "${GREEN}  ✓${NC} Helix installed"

# Docker (optional)
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
  echo -e "${GREEN}  ✓${NC} Docker running"
fi

# GitHub Actions PATH
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  NPM_G=$(npm root -g 2>/dev/null || echo "")
  [ -n "$NPM_G" ] && echo "$(dirname $NPM_G)/bin" >> "$GITHUB_PATH" 2>/dev/null || true
  echo -e "${GREEN}  ✓${NC} GitHub Actions PATH configured"
fi

echo ""
echo -e "  ${CYAN}Quick start:${NC}"
echo "    npx helix serve --port 7842     # Start API server"
echo "    npx helix scan ./src            # Scan for payment patterns"
echo "    npx helix simulate 'nonce low'  # Test diagnosis"
echo ""
echo -e "  ${DIM}Docs: https://github.com/adrianhihi/helix${NC}"
echo ""
