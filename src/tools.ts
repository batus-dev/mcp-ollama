// src/tools.ts
import axios, { AxiosError } from 'axios';
import { z } from 'zod';

const OLLAMA_WEB_SEARCH_URL = 'https://ollama.com/api/web_search';
const OLLAMA_WEB_FETCH_URL = 'https://ollama.com/api/web_fetch';

const MAX_RESULTS_DEFAULT = 5;
const MAX_RESULTS_LIMIT = 10;
const URL_PROTOCOL_REGEX = /^https?:\/\//i;

const ollamaApiKeySchema = z.string().min(1, 'OLLAMA_API_KEY is required.');

const webSearchPayloadSchema = z.object({
  query: z.string().trim().min(1, 'Query must not be empty.'),
  max_results: z
    .number()
    .int('Max results must be an integer.')
    .min(1, 'Max results must be at least 1.')
    .max(MAX_RESULTS_LIMIT, `Max results cannot exceed ${MAX_RESULTS_LIMIT}.`)
    .default(MAX_RESULTS_DEFAULT),
});

const webSearchResultSchema = z.object({
  title: z.string().min(1, 'Result title must not be empty.'),
  url: z.string().min(1, 'Result URL must not be empty.'),
  content: z.string().min(1, 'Result content must not be empty.'),
});

const webSearchResponseSchema = z.object({
  results: z.array(webSearchResultSchema),
});

const webFetchPayloadSchema = z.object({
  url: z
    .string()
    .min(1, 'URL must not be empty.')
    .transform((value) => value.trim())
    .transform((value) => (value && URL_PROTOCOL_REGEX.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, 'URL must be a valid URL.'),
});

const webFetchResponseSchema = z.object({
  title: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'string' ? value.trim() : '')
    ),
  content: z.string().min(1, 'Response content must not be empty.'),
  links: z
    .union([
      z.array(z.string().min(1, 'Each link must not be empty.')),
      z.null(),
      z.undefined(),
    ])
    .transform((value) => (Array.isArray(value) ? value : [])),
});

type WebSearchInput = z.input<typeof webSearchPayloadSchema>;
type WebSearchResponse = z.output<typeof webSearchResponseSchema>;
type WebFetchInput = z.input<typeof webFetchPayloadSchema>;
type WebFetchResponse = z.output<typeof webFetchResponseSchema>;

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

async function postToOllama<
  TPayloadSchema extends z.ZodTypeAny,
  TResponseSchema extends z.ZodTypeAny
>(
  url: string,
  payloadSchema: TPayloadSchema,
  responseSchema: TResponseSchema,
  payload: z.input<TPayloadSchema>
): Promise<z.output<TResponseSchema>> {
  const parsedPayload = payloadSchema.parse(payload);

  try {
    const response = await axiosClient.post(url, parsedPayload);
    return responseSchema.parse(response.data);
  } catch (err) {
    if (err instanceof AxiosError) {
      throw formatAxiosError(err);
    }
    throw new OllamaApiError(
      err instanceof Error ? err.message : 'Unknown error while calling Ollama API.'
    );
  }
}

export async function webSearch(payload: WebSearchInput): Promise<WebSearchResponse> {
  return postToOllama<typeof webSearchPayloadSchema, typeof webSearchResponseSchema>(
    OLLAMA_WEB_SEARCH_URL,
    webSearchPayloadSchema,
    webSearchResponseSchema,
    payload
  );
}

export async function webFetch(payload: WebFetchInput): Promise<WebFetchResponse> {
  return postToOllama<typeof webFetchPayloadSchema, typeof webFetchResponseSchema>(
    OLLAMA_WEB_FETCH_URL,
    webFetchPayloadSchema,
    webFetchResponseSchema,
    payload
  );
}