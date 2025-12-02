// src/http-server.ts
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createOllamaMcpServer } from './mcp-server';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

// Auth token - set via environment variable or use default for development
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || 'dev-token-change-me';
const AUTH_ENABLED = process.env.MCP_AUTH_ENABLED !== 'false'; // enabled by default

// Session storage
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function main(): Promise<void> {
  const fastify = Fastify({ logger: true });

  // Authentication hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!AUTH_ENABLED) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Missing Bearer token' },
        id: null,
      });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (token !== AUTH_TOKEN) {
      reply.status(403).send({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Forbidden: Invalid token' },
        id: null,
      });
      return;
    }
  });

  // MCP endpoint - POST for JSON-RPC requests
  fastify.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && transports[sessionId]) {
        // Reuse existing session
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(request.body)) {
        // New session initialization
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports[id] = transport;
            fastify.log.info(`Session initialized: ${id}`);
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
            fastify.log.info(`Session closed: ${transport.sessionId}`);
          }
        };

        // Connect MCP server to transport
        const mcpServer = createOllamaMcpServer();
        await mcpServer.connect(transport);
      } else {
        // Invalid request - no session and not an initialize request
        reply.status(400).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      fastify.log.error(error, 'Error handling MCP POST request');
      if (!reply.sent) {
        reply.status(500).send({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // MCP endpoint - GET for SSE stream (server-to-client notifications)
  fastify.get('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      reply.status(400).send({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }

    const transport = transports[sessionId];

    try {
      await transport.handleRequest(request.raw, reply.raw);
    } catch (error) {
      fastify.log.error(error, 'Error handling MCP GET request');
      if (!reply.sent) {
        reply.status(500).send({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // MCP endpoint - DELETE for session termination
  fastify.delete('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      reply.status(400).send({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }

    const transport = transports[sessionId];

    try {
      await transport.handleRequest(request.raw, reply.raw);
    } catch (error) {
      fastify.log.error(error, 'Error handling MCP DELETE request');
      if (!reply.sent) {
        reply.status(500).send({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`MCP Streamable HTTP Server listening on http://${HOST}:${PORT}/mcp`);
    console.log(`Authentication: ${AUTH_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    if (AUTH_ENABLED && AUTH_TOKEN === 'dev-token-change-me') {
      console.log(`⚠️  Using default dev token. Set MCP_AUTH_TOKEN env var for production.`);
    }
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

void main();
