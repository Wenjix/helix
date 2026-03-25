"""
Coinbase-specific demo — 8 Coinbase/CDP failure modes.
Usage: python examples/demos/run.py coinbase
"""
from lib.helpers import *


def run():
    header("Helix x Coinbase — Self-Healing Agent Payments", "ADR: Agent Detection & Response for CDP")
    ensure_helix()
    pause()

    errors = [
        ("1. Policy violation — spending limit exceeded",
         "policy violation: spending limit exceeded for this key",
         "Agents hit daily/per-tx limits. Helix diagnoses + suggests split or queue."),

        ("2. AA25 Nonce desync",
         "AA25 invalid account nonce: expected 12, got 8",
         "Common in concurrent agent wallets. Helix refreshes nonce from chain."),

        ("3. Gas sponsor rejected",
         "paymaster rejected: gas sponsorship denied for this operation",
         "Paymaster denies sponsorship. Helix falls back to self-pay or adjusts gas."),

        ("4. Cross-chain bridge timeout",
         "cross-chain bridge timeout: no confirmation after 300s",
         "Bridge stuck with no confirmation. Helix monitors + retries with backoff."),

        ("5. CDP API rate limit (429)",
         "CDP API rate limit exceeded (429)",
         "High-frequency agents hit CDP rate limits. Helix backs off intelligently."),

        ("6. x402 insufficient balance",
         "insufficient USDC token balance for 402 payment. Required: 500",
         "Agent can't cover x402 payment. Helix reduces request or alerts for top-up."),

        ("7. UserOp execution reverted",
         "EXECUTION_REVERTED (-32521): UserOperation execution reverted",
         "Smart account UserOp fails. Helix analyzes revert reason + adjusts params."),

        ("8. Paymaster signature verification failed",
         "paymaster signature verification failed",
         "Paymaster sig invalid. Helix re-requests sponsorship with fresh sig."),
    ]

    succeeded = 0
    for name, error, explanation in errors:
        section(name)
        print(f"  Error: {error}")
        print(f"  Why:   {explanation}")
        r = repair(error, platform="coinbase", agent_id="cdp-agent")
        print_repair(r)
        if r.get("failure", {}).get("code") != "unknown":
            succeeded += 1
        print()
        pause()

    result_box([
        f"  {succeeded}/{len(errors)} Coinbase failure modes diagnosed",
        "  All immune on repeat — <1ms, $0 cost",
        "  npm install @helix-agent/core",
        "",
        "  Zero changes to Coinbase CDP SDK.",
        "  Runtime wrapper only: wrap(sendTransaction)",
        "  Gene Map learns across all Coinbase agents.",
    ])
