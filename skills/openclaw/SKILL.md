# Vial Self-Healing

You have the Vial self-healing runtime active. These protocols run
automatically — no user intervention needed.

---

## 1. Loop Detection

**Trigger:** You have responded 2+ consecutive turns with text
suggestions but called zero tools.

**Action:**
- STOP immediately — do not produce another text response
- Identify the pending task from the conversation
- Execute it NOW using the appropriate tool (exec, browser, message, etc.)
- Do not explain what you're about to do — just do it

**Log:**
```bash
echo "VIAL_LOOP|$(date -u +%s)|loop_detected|execute_forced" >> /tmp/vial.log
```

---

## 2. Task Chain

**Trigger:** You complete a step that was part of a multi-step sequence
(e.g. "write X and send it", "research Y then create a report").

**Action:**
- Do NOT wait for confirmation before proceeding to the next step
- Immediately execute the next step using the relevant tool
- Exception: ask if the next step is destructive (deleting files,
  sending public posts, making purchases)

**Log:**
```bash
echo "VIAL_CHAIN|$(date -u +%s)|task_chain|auto_proceeded" >> /tmp/vial.log
```

---

## 3. Rate Limit / Model Fallback

**Trigger:** A tool call or API request returns a rate limit error
(429, "too many requests", "quota exceeded", "model unavailable").

**Action:**
1. Log the failure
2. Wait the suggested retry-after period if provided (default: 30s)
3. Retry once with the same parameters
4. If still failing, inform the user and suggest checking /settings
   for model configuration

**Log:**
```bash
echo "VIAL_RATE|$(date -u +%s)|rate_limit|$MODEL" >> /tmp/vial.log
```

---

## 4. Auth Repair

**Trigger:** A tool call returns an auth error (401, 403,
"unauthorized", "token expired", "invalid credentials").

**Classify and act:**

| Error type | Signal | Action |
|---|---|---|
| Token expired | "expired", "token invalid" | Attempt re-auth via the tool's login flow |
| Missing scope | "insufficient scope", "permission denied" | Inform user — scope must be re-granted manually |
| Wrong credential | "invalid credentials", "401" generic | Log + inform user to re-check connector settings |

**Log:**
```bash
echo "VIAL_AUTH|$(date -u +%s)|auth_error|$TOOL_NAME" >> /tmp/vial.log
```

---

## 5. Session Recovery

**Trigger:** A session or tool returns an unexpected disconnection,
timeout, or "session not found" error.

**Action:**
1. Do not panic or report failure immediately
2. Retry the operation once after 5 seconds
3. If retry succeeds, continue silently
4. If retry fails, report the specific error to the user with context

**Log:**
```bash
echo "VIAL_SESSION|$(date -u +%s)|session_error|retry" >> /tmp/vial.log
```

---

## 6. Silent Failure Detection

**Trigger:** A tool call returns success (200/OK) but the expected
outcome did not happen (file not created, message not sent, etc.).

**Action:**
1. Verify the outcome with a follow-up read/check tool call
2. If verification fails, retry the original operation once
3. If second attempt also silently fails, report to user with details

**Log:**
```bash
echo "VIAL_SILENT|$(date -u +%s)|silent_failure|$TOOL_NAME" >> /tmp/vial.log
```

---

## Vial Log

All events are written to `/tmp/vial.log` in this format:
```
VIAL_{TYPE}|{unix_timestamp}|{strategy}|{detail}
```

This log is read periodically to improve Vial's repair protocols.
You do not need to show it to the user unless asked.

---

*Powered by Vial — self-healing runtime for AI agents*
*github.com/adrianhihi/helix · vial.ai*
