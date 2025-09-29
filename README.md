# Ollama MCP Server

Robust Model Context Protocol (MCP) server exposing Ollama-powered web tooling. The server is implemented in TypeScript and packaged for Node.js runtimes.

## Features

- **MCP-compliant transport** built with `@modelcontextprotocol/sdk` and wired to STDIO.
- **Validated tool inputs** using `zod` to guarantee contracts before contacting Ollama.
- **Centralized HTTP client** backed by Axios with timeouts and consistent error translation.
- **Inspector integration** via `@modelcontextprotocol/inspector` for interactive debugging sessions.

## Requirements

- Node.js 20+
- npm 9+
- Valid `OLLAMA_API_KEY`

## Installation

```bash
npm install
```

When developing locally, also install dev dependencies (already handled by `npm install`).

## Configuration

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OLLAMA_API_KEY` | ✅ | Bearer token used to authenticate against the Ollama web API. |

Export the variable or add it to your process manager before starting the server:

```bash
export OLLAMA_API_KEY="your-token"
```

## Available scripts

- **`npm run build`**: Compile TypeScript sources into `dist/`.
- **`npm start`**: Start the compiled MCP server (`node dist/index.js`).
- **`npm run inspector`**: Launch MCP Inspector, proxying to `node dist/index.js` for interactive tool and resource inspection.

### Typical workflow

1. Build the project: `npm run build`
2. Run the inspector (optional): `npm run inspector`
3. Run the compiled server directly: `npm start`

## Tool reference

### `web_search`

- **Purpose**: Perform a web search via the Ollama API.
- **Input shape**:
  - `query` (string, required)
  - `max_results` (integer, optional, 1-20)
- **Output**: JSON stringified search result payload returned by Ollama.

### `web_fetch`

- **Purpose**: Fetch the contents of a URL through the Ollama API.
- **Input shape**:
  - `url` (string URL, required)
- **Output**: JSON stringified response body supplied by Ollama.

## Architecture overview

- `src/index.ts`: Program entrypoint. Creates STDIO transport and connects the MCP server.
- `src/mcp-server.ts`: MCP server definition, tool registration, and framework-agnostic error normalization.
- `src/tools.ts`: Axios client + implementations of the Ollama web APIs with schema validation.

## Error handling & logging

- HTTP failures are wrapped in `OllamaApiError` and translated into `McpError` instances before surfacing to clients.
- Startup logs are emitted via MCP logging notifications and mirrored to stderr for visibility.

## Troubleshooting

- **`OLLAMA_API_KEY is required.`** Ensure the environment variable is set before invoking any script.
- **Timeouts calling Ollama**: Increase Axios timeout or check network connectivity.
- **Inspector connection issues**: Confirm no other process uses ports `6274` or `6277`, and verify the session token provided in the inspector output.

## Contributing

1. Fork or branch.
2. Install dependencies (`npm install`).
3. Apply changes and accompany them with unit or integration tests when available.
4. Run `npm run build` to ensure TypeScript compilation passes.

## License

Specify your chosen license here (e.g., MIT, Apache-2.0). Update `package.json` accordingly.
