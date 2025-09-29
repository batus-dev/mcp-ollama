// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createOllamaMcpServer } from './mcp-server';

async function main(): Promise<void> {
  const server = createOllamaMcpServer();
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
    server.sendLoggingMessage({ level: 'info', message: 'Ollama MCP Server ready.' }).catch(
      (error) => {
        console.error('Failed to send logging message:', error);
      }
    );
    console.error('Ollama MCP Server started. Waiting for requests...');
  } catch (error) {
    console.error('Failed to start Ollama MCP Server:', error);
    process.exitCode = 1;
  }
}

void main();