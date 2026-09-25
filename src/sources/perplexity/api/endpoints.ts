/** Perplexity web app origin (session cookies live here). */
export const BASE_URL = 'https://www.perplexity.ai';

/** Internal REST API version used by the web UI (undocumented; may change). */
export const API_VERSION = '2.18';

export const ENDPOINTS = {
  HOME: `${BASE_URL}/`,
  SESSION: '/api/auth/session',
  LIST_ASK_THREADS: `/rest/thread/list_ask_threads?version=${API_VERSION}&source=default`,
  THREAD: (uuid: string, cursor?: string) => {
    const base =
      `/rest/thread/${encodeURIComponent(uuid)}` +
      `?with_schematized_response=true&version=${API_VERSION}&source=default` +
      `&limit=100&offset=0&from_first=true` +
      `&supported_block_use_cases=answer_modes` +
      `&supported_block_use_cases=preserve_latex`;
    return cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
  },
} as const;
