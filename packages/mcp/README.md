# @helix-agent/mcp

MCP Server for Helix — exposes self-healing payment repair tools to AI agents.

## Tools

- **helix_diagnose** — Classify a payment error and get a repair recommendation (observe only)
- **helix_repair** — Diagnose and execute a repair
- **helix_gene_status** — Check Gene Map state
- **helix_check_immunity** — Check if an error type has existing immunity

## Usage

```bash
npx @helix-agent/mcp
```

Or add to Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "helix": {
      "command": "npx",
      "args": ["@helix-agent/mcp"]
    }
  }
}
```
