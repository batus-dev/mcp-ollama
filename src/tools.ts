// src/tools.ts
import axios, { AxiosError } from 'axios';
import { z } from 'zod';

const OLLAMA_WEB_SEARCH_URL = 'https://ollama.com/api/web_search';
const OLLAMA_WEB_FETCH_URL = 'https://ollama.com/api/web_fetch';

const MAX_RESULTS_DEFAULT = 5;
const MAX_RESULTS_LIMIT = 20;

const ollamaApiKeySchema = z.string().min(1, 'OLLAMA_API_KEY is required.');

const webSearchPayloadSchema = z.object({
  query: z.string().min(1, 'Query must not be empty.'),
  max_results: z
    .number()
    .int('Max results must be an integer.')
    .min(1, 'Max results must be at least 1.')
    .max(MAX_RESULTS_LIMIT, `Max results cannot exceed ${MAX_RESULTS_LIMIT}.`)
    .default(MAX_RESULTS_DEFAULT),
});

const webFetchPayloadSchema = z.object({
  url: z.string().url('URL must be a valid URL.'),
});

type WebSearchPayload = z.output<typeof webSearchPayloadSchema>;
type WebSearchInput = z.input<typeof webSearchPayloadSchema>;
type WebFetchPayload = z.output<typeof webFetchPayloadSchema>;
type WebFetchInput = z.input<typeof webFetchPayloadSchema>;

const env = {
  OLLAMA_API_KEY: ollamaApiKeySchema.parse(process.env.OLLAMA_API_KEY),
};

const headers = Object.freeze({
  Authorization: `Bearer ${env.OLLAMA_API_KEY}`,
  'Content-Type': 'application/json',
});

const axiosClient = axios.create({
  headers,
  timeout: 15_000,
});

class OllamaApiError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OllamaApiError';
    this.status = status;
  }
}

function formatAxiosError(error: AxiosError): OllamaApiError {
  if (error.response) {
    const { status, data } = error.response;
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    return new OllamaApiError(
      `Ollama API responded with status ${status}: ${message}`,
      status
    );
  }

  if (error.request) {
    return new OllamaApiError('No response received from Ollama API.');
  }

  return new OllamaApiError(error.message ?? 'Unknown Axios error.');
}

async function postToOllama<TSchema extends z.ZodTypeAny, TResult>(
  url: string,
  payloadSchema: TSchema,
  payload: z.input<TSchema>
): Promise<TResult> {
  const parsedPayload = payloadSchema.parse(payload);

  try {
    const response = await axiosClient.post<TResult>(url, parsedPayload);
    return response.data;
  } catch (err) {
    if (err instanceof AxiosError) {
      throw formatAxiosError(err);
    }
    throw new OllamaApiError(
      err instanceof Error ? err.message : 'Unknown error while calling Ollama API.'
    );
  }
}

export async function webSearch(payload: WebSearchInput): Promise<WebSearchPayload> {
  return postToOllama<typeof webSearchPayloadSchema, WebSearchPayload>(
    OLLAMA_WEB_SEARCH_URL,
    webSearchPayloadSchema,
    payload
  );
}

export async function webFetch(payload: WebFetchInput): Promise<WebFetchPayload> {
  return postToOllama<typeof webFetchPayloadSchema, WebFetchPayload>(
    OLLAMA_WEB_FETCH_URL,
    webFetchPayloadSchema,
    payload
  );
}