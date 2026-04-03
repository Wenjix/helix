# VialOS Compatibility

## Beta Mode

Enable beta features with the `--beta` flag:

```bash
npx @helix-agent/core serve --port 7842 --mode observe --beta
```

Beta features:
- `GET /vial/status` — VialOS runtime information
- VialOS metadata in `GET /health` response
- "Powered by VialOS Runtime" dashboard badge

Without `--beta`, Helix behaves identically to the stable release.

## Gene Map Schema (v12)

Helix and VialOS runtime share the same Gene Map schema.

## PCEC Interface Contract

```typescript
interface PCECEngine {
  perceive(error: ErrorInput): Promise<PerceiveResult>;
  construct(perception: PerceiveResult): Promise<Strategy[]>;
  evaluate(strategies: Strategy[], ctx: EvalContext): Promise<RankedStrategy[]>;
  commit(strategy: RankedStrategy): Promise<CommitResult>;
  verify(result: CommitResult): Promise<VerifyResult>;
  recordGene(result: VerifyResult): Promise<void>;
}
```
