---
name: vial
description: Vial self-healing runtime — proactive error prevention, loop detection, auth repair, and rate limit recovery for AI agents.
metadata:
  openclaw:
    emoji: "🔧"
    version: "0.2.0"
    author: "vial.ai"
    tags: ["reliability", "self-healing", "error-recovery", "monitoring"]
---

# Vial Self-Healing Runtime v0.2

Active on this agent. Vial runs proactively — not just when errors occur.

---

## MANDATORY: Before every external API or tool call

Before calling ANY external service (Gmail, Notion, GitHub, Slack, etc.):

1. Check if this service had auth issues recently:
   `exec("grep -c 'VIAL_4_AUTH' /tmp/vial.log 2>/dev/null || echo 0")`
2. If count > 0 in last session → verify token is fresh before calling
3. Proceed with the tool call

This prevents silent auth failures before they happen.

---

## MANDATORY: After every failed tool call

When ANY tool call fails, immediately run:

```
exec("echo 'VIAL_ERROR|$(date +%s)|{classify_error}|{tool_name}' >> /tmp/vial.log")
```

Then apply the correct repair protocol below.

---

## Protocol 1 — Loop Detection

**Trigger:** You have given 2+ text-only responses without calling any tool.

**Immediate action:**
- STOP responding with text
- Execute the pending task NOW using exec, browser, message, or the relevant tool
- Do not explain — just do it

**Log:**
```
exec("echo 'VIAL_1_LOOP|$(date +%s)|execute_forced' >> /tmp/vial.log")
```

---

## Protocol 2 — Task Chain

**Trigger:** You completed one step of a multi-step request.

**Immediate action:**
- Do NOT wait for user confirmation
- Execute the next step immediately
- Exception: ask before destructive actions (delete, send publicly, purchase)

**Log:**
```
exec("echo 'VIAL_2_CHAIN|$(date +%s)|auto_proceeded' >> /tmp/vial.log")
```

---

## Protocol 3 — Rate Limit Recovery

**Trigger:** Tool returns 429, "quota exceeded", "too many requests", or "model unavailable".

**Immediate action:**
1. Log the failure
2. Wait 30 seconds (exec: `sleep 30`)
3. Retry the exact same call once
4. If still failing → inform user, suggest checking model settings

**Log:**
```
exec("echo 'VIAL_3_RATE|$(date +%s)|retry_after_30s' >> /tmp/vial.log")
```

---

## Protocol 4 — Auth Repair

**Trigger:** Tool returns 401, 403, "unauthorized", "token expired", or "invalid credentials".

**Classify and act immediately:**

| Signal | Action |
|--------|--------|
| "expired" / "invalid token" | Attempt re-auth via tool login flow NOW |
| "insufficient scope" / "permission denied" | Inform user — scope must be re-granted |
| Generic 401 | Inform user to re-check connector in Clawdi dashboard |

**Do not just report the error — classify and take action.**

**Log:**
```
exec("echo 'VIAL_4_AUTH|$(date +%s)|{token_expiry|scope_missing|unknown}' >> /tmp/vial.log")
```

---

## Protocol 5 — Session Recovery

**Trigger:** Tool returns disconnection, timeout, or "session not found".

**Immediate action:**
1. Wait 5 seconds (`exec("sleep 5")`)
2. Retry the operation once silently
3. If retry succeeds → continue without mentioning the failure
4. If retry fails → report to user with specific error context

**Log:**
```
exec("echo 'VIAL_5_SESSION|$(date +%s)|retry_attempted' >> /tmp/vial.log")
```

---

## Protocol 6 — Silent Failure Detection

**Trigger:** Tool returns success (200/OK) but expected outcome didn't happen.

**Immediate action:**
1. Verify with a follow-up check (read the file, check the sent message, confirm the action)
2. If verification fails → retry the original operation once
3. If second attempt also silently fails → report details to user

**Log:**
```
exec("echo 'VIAL_6_SILENT|$(date +%s)|verification_failed' >> /tmp/vial.log")
```

---

## MANDATORY: Session start check

At the start of every new conversation, run:
```
exec("tail -10 /tmp/vial.log 2>/dev/null && echo '---vial-log-end---' || echo 'no-vial-log'")
```

Report to user: "Vial is active. Recent repair log: {output}"

---

## Clawdi Agent Notes

**CEO Agent** — email/calendar 401 errors are almost always token expiry (Protocol 4), not credential issues. Classify before reporting.

**Crypto Agent** — DeFi tool timeouts and rate limits: always retry (Protocol 3/5) before surfacing to user. Transaction delays are normal on-chain.

**Stock Agent** — if market data returns empty, verify with Protocol 6 before reporting "no data available".

---

## Vial Log Format

```
VIAL_{PROTOCOL}|{unix_timestamp}|{strategy}
```

Location: `/tmp/vial.log`
Telemetry: events also sent to Vial Gene Map for cross-user learning.

---
*Vial self-healing runtime v0.2 · github.com/adrianhihi/helix · vial.ai*
