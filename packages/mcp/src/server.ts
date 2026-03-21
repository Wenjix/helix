#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createEngine, GeneMap } from '@helix-agent/core';
import type { WrapOptions } from '@helix-agent/core';

const observeEngine = createEngine({ mode: 'observe', agentId: 'helix-mcp', geneMapPath: ':memory:' } as WrapOptions);

const server = new Server(
  { name: 'helix-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'helix_diagnose',
      description: 'Diagnose a payment error and recommend a repair strategy (observe only — does NOT execute).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error_message: { type: 'string', description: 'The error message from the failed payment' },
          platform: { type: 'string', description: 'Platform hint: tempo, privy, coinbase, generic' },
          context: { type: 'object', description: 'Additional context (agentId, walletAddress, etc)' },
        },
        required: ['error_message'],
      },
    },
    {
      name: 'helix_repair',
      description: 'Diagnose AND execute a repair for a payment error. Returns result with verification.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error_message: { type: 'string', description: 'The error message' },
          context: { type: 'object', description: 'Additional context for repair' },
        },
        required: ['error_message'],
      },
    },
    {
      name: 'helix_gene_status',
      description: 'Check the current Gene Map — genes, platform coverage, top strategies.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'helix_check_immunity',
      description: 'Check if a specific error type has an existing Gene (immunity).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error_code: { type: 'string', description: 'Error code (e.g. verification-failed)' },
          category: { type: 'string', description: 'Failure category (e.g. signature)' },
        },
        required: ['error_code', 'category'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, unknown>;

  switch (name) {
    case 'helix_diagnose': {
      const result = await observeEngine.repair(
        new Error(a.error_message as string),
        a.context as Record<string, unknown>,
      );
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            classified: { code: result.failure.code, category: result.failure.category, severity: result.failure.severity, platform: result.failure.platform },
            recommendation: result.winner ? { strategy: result.winner.strategy, description: result.winner.description, costUsd: result.winner.estimatedCostUsd, speedMs: result.winner.estimatedSpeedMs } : null,
            immune: result.immune,
            gene: result.gene ? { strategy: result.gene.strategy, qValue: result.gene.qValue, successCount: result.gene.successCount, platforms: result.gene.platforms } : null,
            explanation: result.explanation,
          }, null, 2),
        }],
      };
    }

    case 'helix_repair': {
      const autoEngine = createEngine({ mode: 'auto', agentId: 'helix-mcp', geneMapPath: ':memory:' } as WrapOptions);
      const result = await autoEngine.repair(new Error(a.error_message as string), a.context as Record<string, unknown>);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: result.success, strategy: result.winner?.strategy, verified: result.verified, immune: result.immune, explanation: result.explanation, totalMs: result.totalMs }, null, 2),
        }],
      };
    }

    case 'helix_gene_status': {
      const stats = observeEngine.getGeneMap().stats();
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
    }

    case 'helix_check_immunity': {
      const gene = observeEngine.getGeneMap().lookup(a.error_code as string, a.category as string);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            immune: !!gene && gene.qValue > 0.4,
            gene: gene ? { strategy: gene.strategy, qValue: gene.qValue, successCount: gene.successCount, platforms: gene.platforms } : null,
          }, null, 2),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Helix MCP server started');
}

main().catch(console.error);
