# @helix-agent/core

Self-healing infrastructure for AI agent payments.

See the [root README](../../README.md) for full documentation.

## Quick Start

```bash
npm install @helix-agent/core
```

```typescript
import { wrap } from '@helix-agent/core';

const resilientPay = wrap(myPaymentFunction);
const result = await resilientPay(invoice);
```

## License

MIT
