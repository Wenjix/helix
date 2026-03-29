// ── Core engine ──
export { PcecEngine } from './engine/pcec.js';
export { GeneMap, calculateAdaptiveAlpha, thompsonSample } from './engine/gene-map.js';
export { wrap, createEngine, shutdown } from './engine/wrap.js';
export { evaluate } from './engine/evaluate.js';
export { detectSignature, applyOverrides } from './engine/auto-detect.js';
export { llmClassify, llmConstructCandidates, llmGenerateReasoning } from './engine/llm.js';

// ── Platform adapter interface ──
export { AdapterRegistry } from './engine/adapter.js';
export type { VialPlatformAdapter } from './engine/adapter.js';

// ── Types ──
export type {
  FailureClassification,
  RepairCandidate,
  GeneCapsule,
  StrategyStep,
  RepairResult,
  PlatformAdapter,
  ErrorCode,
  FailureCategory,
  Platform,
  Severity,
  WrapOptions,
  HelixMode,
  RepairContext,
} from './engine/types.js';
export { REVENUE_AT_RISK, DEFAULT_CONFIG } from './engine/types.js';

// ── Learning modules ──
export { CausalGraph } from './engine/causal-graph.js';
export { NegativeKnowledge } from './engine/negative-knowledge.js';
export { MetaLearner } from './engine/meta-learner.js';
export { AdaptiveWeights } from './engine/adaptive-weights.js';
export { SafetyVerifier } from './engine/safety-verifier.js';
export { SelfPlayEngine } from './engine/self-play.js';
export { FederatedLearner } from './engine/federated.js';
export { StrategyGenerator } from './engine/strategy-generator.js';
export { AdapterDiscovery } from './engine/adapter-discovery.js';
export { AdversarialDefense } from './engine/adversarial.js';

// ── Utilities ──
export { EventBus, bus } from './engine/bus.js';
export { GeneDream } from './engine/dream.js';
export { tokenize, matchErrorSignature, addSignature, getSignatures } from './engine/error-embedding.js';
export { checkConditions, getConditionMultiplier, updateGeneConditions } from './engine/conditional-genes.js';

// ── Testing ──
export { simulate } from './testing.js';
