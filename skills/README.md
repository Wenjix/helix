# Vial Skills

Platform-specific skill integrations for the Vial self-healing runtime.

Each subdirectory contains a `SKILL.md` file that can be installed
into the corresponding agent platform.

## Available Skills

| Platform | Path | Install |
|---|---|---|
| OpenClaw / Clawdi | `skills/openclaw/SKILL.md` | `openclaw hooks install` or `clawdi.skills.install` RPC |

## Installation (OpenClaw / Clawdi)

```bash
# Via CLI (self-hosted OpenClaw)
mkdir -p ~/.openclaw/workspace/skills/vial
curl -o ~/.openclaw/workspace/skills/vial/SKILL.md \
  https://raw.githubusercontent.com/adrianhihi/helix/main/skills/openclaw/SKILL.md

# Via Clawdi RPC
clawdi.skills.install({
  source: "raw",
  url: "https://raw.githubusercontent.com/adrianhihi/helix/main/skills/openclaw/SKILL.md",
  slug: "vial"
})
```
