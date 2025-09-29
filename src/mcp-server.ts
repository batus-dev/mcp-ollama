// src/mcp-server.ts
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { webSearch, webFetch } from './tools';

const toolInputSchemas = {
  webSearch: {
    query: z.string().min(1, 'Search query is required.'),
    max_results: z
      .number()
      .int('Max results must be an integer.')
      .min(1)
      .max(20)
      .optional(),
  },
  webFetch: {
    url: z.string().url('URL must be valid.'),
  },
} satisfies Record<string, z.ZodRawShape>;

export function createOllamaMcpServer(): McpServer {
  const server = new McpServer({
    name: 'Ollama Web Tools',
    version: '1.0.0',
  });

  server.registerTool(
    'web_search',
    {
      title: 'Web Search',
      description: 'Perform a web search using the Ollama web search API.',
      inputSchema: toolInputSchemas.webSearch,
    },
    async ({ query, max_results }) => {
      try {
        const response = await webSearch({ query, max_results });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        throw normalizeToMcpError(error);
      }
    }
  );

  server.registerTool(
    'web_fetch',
    {
      title: 'Web Fetch',
      description: 'Fetch raw content from a URL using the Ollama web fetch API.',
      inputSchema: toolInputSchemas.webFetch,
    },
    async ({ url }) => {
      try {
        const response = await webFetch({ url });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        throw normalizeToMcpError(error);
      }
    }
  );

  return server;
}

function normalizeToMcpError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof Error) {
    if ('status' in error && typeof (error as any).status === 'number') {
      const status = (error as any).status as number;
      const message = error.message ?? 'Unknown Ollama API error.';
      return new McpError(status, message);
    }

    return new McpError(500, error.message);
  }

  return new McpError(500, 'Unknown error occurred.');
}