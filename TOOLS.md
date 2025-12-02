# Tool Reference for Flowise Integration

This document provides copy-ready details for the two MCP tools defined in `src/tools.ts`. Each section summarizes the tool, documents its parameters, and includes a CommonJS helper you can paste into Flowise custom nodes or serverless functions.

## `web_search`

- **Source**: `src/tools.ts`
- **General description**: Calls the Ollama Web Search API. Validates the search query and optional maximum results, then relays the HTTP response back to the MCP client as JSON content.

### Parameters
- **`query`** (`string`, required) – Text to search on the web. Empty strings are rejected by validation.
- **`max_results`** (`number`, optional) – Integer between 1 and 20. Defaults to 5 when omitted. Controls how many search results the Ollama backend should return.

### Copy-paste logic (CommonJS + `fetch`)
```javascript
let fetchFn;

if (typeof fetch === 'function') {
  fetchFn = fetch;                     // Node >= 18
} else {
  fetchFn = require('node-fetch');     // Node < 18
}
const OLLAMA_WEB_SEARCH_URL = 'https://ollama.com/api/web_search';
const apiKey = $vars.OLLAMA_API_KEY;
if (!apiKey) {
  throw new Error('Set OLLAMA_API_KEY before calling webSearchNode.');
}
// console.log('apiKey', apiKey)

if (!$query || typeof $query !== 'string') {
  throw new Error('query must be a non-empty string.');
}

const payload = {
  query: $query,
  max_results: Number.isFinite($maxResults) ? $maxResults : 5,
};
// console.log('query', payload)

const response = await fetchFn(OLLAMA_WEB_SEARCH_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});


if (!response.ok) {
  const errorBody = await response.text();
  throw new Error(`Ollama web search failed (${response.status}): ${errorBody}`);
}
console.log('ok')

return response.json();

```

### Notes
- Validate `query` on the Flowise side if user input might be empty.
- The response is stringified JSON; parse before downstream consumption.

## `web_fetch`

- **Source**: `src/tools.ts`
- **General description**: Uses the Ollama Web Fetch API to download the contents of a URL. Ensures the supplied URL string is valid and forwards the fetched payload to the MCP caller.

### Parameters
- **`url`** (`string`, required) – Absolute URL (including protocol) pointing to the resource to fetch. Invalid URLs are rejected before the HTTP request is made.

### Copy-paste logic (CommonJS + `fetch`)
```javascript
// flowise-nodes/webFetch.js
const OLLAMA_WEB_FETCH_URL = 'https://ollama.com/api/web_fetch';

module.exports = async function webFetchNode({ url }) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    throw new Error('Set OLLAMA_API_KEY before calling webFetchNode.');
  }

  if (!url || typeof url !== 'string') {
    throw new Error('url must be a non-empty string.');
  }

  const response = await fetch(OLLAMA_WEB_FETCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama web fetch failed (${response.status}): ${errorBody}`);
  }

  return response.json();
};
```

### Notes
- Prefer pre-validating URLs in Flowise to surface input errors early.
- Combine `web_search` and `web_fetch` to automate research: search for relevant pages, pick a URL, then fetch its contents for summarization.
