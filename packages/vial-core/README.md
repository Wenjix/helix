# @vial/core

**Self-evolving repair framework for autonomous agents.**

Vial is the generic self-healing engine that powers [Helix](https://github.com/adrianhihi/helix). It provides a PCEC (Perceive → Construct → Evaluate → Commit) loop with reinforcement learning, so your agent fixes its own errors and gets better over time.

## Quick Start

```bash
npm install @vial/core
```

```typescript
import { wrap, AdapterRegistry } from '@vial/core';
import type { VialPlatformAdapter } from '@vial/core';

// 1. Define your platform adapter
const myAdapter: VialPlatformAdapter = {
  name: 'my-api',
  perceive(error) {
    const msg = typeof error === 'string' ? error : error.message;
    if (msg.includes('rate limit')) {
      return { code: 'rate-limited', category: 'throttle', strategy: 'backoff_retry' };
    }
    if (msg.includes('timeout')) {
      return { code: 'timeout', category: 'network', strategy: 'retry' };
    }
    return null;
  },
  getPatterns() {
    return [
      { pattern: /rate limit/i, code: 'rate-limited', category: 'throttle', strategy: 'backoff_retry' },
      { pattern: /timeout/i, code: 'timeout', category: 'network', strategy: 'retry' },
    ];
  },
};

// 2. Wrap your function
const safeCall = wrap(myApiFunction, { mode: 'auto' });
const result = await safeCall(args);
// Errors are automatically diagnosed, fixed, and retried
```

## What Vial Provides

- **PCEC Engine** — 6-stage repair pipeline (Perceive → Construct → Evaluate → Commit → Verify → Gene)
- **Gene Map** — SQLite-backed knowledge base that remembers what fixes work
- **wrap()** — One-line integration, automatic error interception and retry
- **Meta-Learning** — 3 similar repairs → learns pattern → 4th variant is instant
- **Safety Verification** — 7 pre-execution constraints (never modifies dangerous params)
- **Self-Play** — Autonomous error discovery and stress testing
- **Federated Learning** — Privacy-preserving distributed learning across agents
- **Adaptive Weights** — Auto-tunes scoring dimensions per error category
- **Causal Graph** — Predicts which errors follow which

## Built With Vial

- **[Helix](https://github.com/adrianhihi/helix)** — Self-healing payments for AI agents (Coinbase, Tempo, Privy)
- *Your project here* — implement `VialPlatformAdapter` for any domain

## License

MIT
