# Ollama MCP Server

Robust Model Context Protocol (MCP) server exposing Ollama-powered web tooling. The server is implemented in TypeScript and packaged for Node.js runtimes.

## Features

- **Dual transport support**:
  - **STDIO** for local integrations (Claude Desktop, etc.)
  - **Streamable HTTP** for remote/web deployments with full SSE support
- **Session management** with stateful connections for HTTP transport
- **Bearer token authentication** for HTTP transport (configurable)
- **Validated tool inputs** using `zod` to guarantee contracts before contacting Ollama
- **Centralized HTTP client** backed by Axios with timeouts and consistent error translation
- **Inspector integration** via `@modelcontextprotocol/inspector` for interactive debugging

## Requirements

- Node.js 20+
- npm 9+
- Valid `OLLAMA_API_KEY`

## Installation

```bash
npm install
```

## Configuration

### Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OLLAMA_API_KEY` | ✅ | — | Bearer token for Ollama web API |
| `PORT` | ❌ | `3000` | HTTP server port (HTTP mode only) |
| `HOST` | ❌ | `127.0.0.1` | HTTP server bind address |
| `MCP_AUTH_ENABLED` | ❌ | `true` | Enable/disable Bearer token auth |
| `MCP_AUTH_TOKEN` | ❌ | `dev-token-change-me` | Secret token for HTTP auth |

Export variables before starting:

```bash
export OLLAMA_API_KEY="your-ollama-token"
export MCP_AUTH_TOKEN="your-secret-token"  # For HTTP mode
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run build` | Compile TypeScript sources into `dist/` |
| `npm start` | Start STDIO server (alias for `start:stdio`) |
| `npm run start:stdio` | Start MCP server with STDIO transport |
| `npm run start:http` | Start MCP server with Streamable HTTP transport |
| `npm run inspector` | Launch MCP Inspector with STDIO server |
| `npm run inspector:http` | Launch MCP Inspector (connect manually to HTTP) |
| `npm run dev` | Build + run inspector (STDIO) |
| `npm run dev:http` | Build + start HTTP server |

## Usage

### STDIO mode (local integrations)

Best for Claude Desktop, local CLI tools, or spawned subprocesses.

```bash
npm run build
npm start
```

#### Claude Desktop configuration

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ollama-web-tools": {
      "command": "node",
      "args": ["/path/to/ollama-mcp-server/dist/index.js"],
      "env": {
        "OLLAMA_API_KEY": "your-ollama-token"
      }
    }
  }
}
```

### HTTP mode (remote/web deployments)

Best for remote servers, web integrations, or multi-client scenarios.

```bash
npm run build
npm run start:http
```

Server starts at `http://127.0.0.1:3000/mcp` by default.

#### HTTP endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/mcp` | JSON-RPC requests (initialize, tool calls, etc.) |
| `GET` | `/mcp` | SSE stream for server-to-client notifications |
| `DELETE` | `/mcp` | Terminate session |

#### Authentication

HTTP mode requires Bearer token authentication by default:

```bash
# With auth (default)
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{}},"id":1}'

# Disable auth for development
MCP_AUTH_ENABLED=false npm run start:http
```

#### Session flow

1. **Initialize** (POST without `mcp-session-id`):
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{}},"id":1}'
   ```
   Response includes `mcp-session-id` header.

2. **Subsequent requests** (POST with `mcp-session-id`):
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
   ```

3. **SSE stream** (GET with `mcp-session-id`):
   ```bash
   curl -N http://localhost:3000/mcp \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -H "Accept: text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID"
   ```

4. **Terminate session** (DELETE):
   ```bash
   curl -X DELETE http://localhost:3000/mcp \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -H "mcp-session-id: YOUR_SESSION_ID"
   ```

## Testing with MCP Inspector

### STDIO mode

```bash
npm run build
npm run inspector
```

### HTTP mode

```bash
# Terminal 1: Start server (disable auth for easier testing)
MCP_AUTH_ENABLED=false npm run start:http

# Terminal 2: Open inspector
npm run inspector:http
```

In the Inspector UI:
1. Select **"Streamable HTTP"** as transport type
2. Enter URL: `http://localhost:3000/mcp`
3. Click **Connect**

## Tool reference

### `web_search`

Perform a web search via the Ollama API.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | ✅ | Search query |
| `max_results` | integer | ❌ | Results limit (1-20) |

**Output**: JSON stringified search results from Ollama.

### `web_fetch`

Fetch contents of a URL through the Ollama API.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string (URL) | ✅ | URL to fetch |

**Output**: JSON stringified response body from Ollama.

## Architecture overview

```
src/
├── index.ts        # STDIO entrypoint
├── http-server.ts  # HTTP/SSE entrypoint (Fastify)
├── mcp-server.ts   # MCP server definition & tool registration
└── tools.ts        # Ollama API client & implementations
```

| File | Description |
| --- | --- |
| `index.ts` | STDIO transport, connects MCP server to stdin/stdout |
| `http-server.ts` | Fastify server with Streamable HTTP transport, sessions, SSE, and auth |
| `mcp-server.ts` | MCP server factory, tool definitions, error normalization |
| `tools.ts` | Axios client, Ollama API calls, Zod schema validation |

## Error handling & logging

- HTTP failures are wrapped in `OllamaApiError` and translated into `McpError` instances
- STDIO mode logs to stderr
- HTTP mode uses Fastify's built-in logger

## Troubleshooting

| Issue | Solution |
| --- | --- |
| `OLLAMA_API_KEY is required` | Set the environment variable before starting |
| `Unauthorized: Missing Bearer token` | Add `Authorization: Bearer <token>` header |
| `Forbidden: Invalid token` | Check `MCP_AUTH_TOKEN` matches your header |
| `Invalid or missing session ID` | Initialize first, then use returned session ID |
| Timeouts calling Ollama | Check network connectivity or increase Axios timeout |
| Inspector connection issues | Ensure ports `6274`/`6277` are free |

## Security considerations

- **HTTP mode binds to `127.0.0.1` by default** — change `HOST` to `0.0.0.0` only if needed
- **Always set a strong `MCP_AUTH_TOKEN`** in production
- **Never commit tokens** to version control

## Contributing

1. Fork or branch
2. Install dependencies: `npm install`
3. Make changes with tests when applicable
4. Verify build: `npm run build`
5. Submit PR

## License

Specify your chosen license here (e.g., MIT, Apache-2.0). Update `package.json` accordingly.
