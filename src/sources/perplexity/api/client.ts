import { ENDPOINTS } from './endpoints.js';
import { PerplexityCdpHttp } from './cdp-http.js';
import {
  listItemToConversation,
  threadToDetail,
} from './map.js';
import type {
  PerplexityConversationDetail,
  PerplexityConversationItem,
  PerplexityExportBundle,
  ThreadDetailResponse,
  ThreadEntry,
  ThreadListItem,
  ThreadListRequest,
} from './types.js';
import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';

export type PerplexityClientOptions = {
  cdpPort?: number;
  /** Parallel CDP tabs (default 3). */
  concurrency?: number;
  /** Min gap between starting requests (ms). */
  delayMs?: number;
  verbose?: boolean;
  onListProgress?: (fetched: number) => void;
  onDownloadProgress?: (completed: number, total: number) => void;
};

export class PerplexityClient {
  private cdp: PerplexityCdpHttp;
  private verbose: boolean;
  private ownsCdp: boolean;

  constructor(
    cdp: PerplexityCdpHttp,
    options: { verbose?: boolean; ownsCdp?: boolean } = {}
  ) {
    this.cdp = cdp;
    this.verbose = options.verbose ?? false;
    this.ownsCdp = options.ownsCdp ?? true;
  }

  get throttleStats() {
    return this.cdp.stats;
  }

  get cdpWorkers(): number {
    return this.cdp.workerCount;
  }

  static async connect(
    options: PerplexityClientOptions = {}
  ): Promise<PerplexityClient> {
    const cdp = await PerplexityCdpHttp.connect(
      options.cdpPort ?? DEFAULT_CDP_PORT,
      {
        poolSize: options.concurrency ?? 3,
        minGapMs: options.delayMs ?? 200,
      }
    );
    const client = new PerplexityClient(cdp, {
      verbose: options.verbose,
      ownsCdp: true,
    });
    await client.assertLoggedIn();
    return client;
  }

  async close(): Promise<void> {
    if (this.ownsCdp) await this.cdp.close();
  }

  private async requestJson<T>(
    pathOrUrl: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const res = await this.cdp.fetch(pathOrUrl, { method, headers, body });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Perplexity API ${res.status}: not authenticated. Log in at https://www.perplexity.ai/ in the CDP browser, then retry.`
      );
    }
    if (res.status === 0) {
      throw new Error(res.bodyText || 'Perplexity CDP fetch failed (wrong host)');
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Perplexity API ${res.status} ${res.statusText}: ${res.bodyText.slice(0, 200)}`
      );
    }
    try {
      return JSON.parse(res.bodyText) as T;
    } catch {
      throw new Error(
        `Perplexity API returned non-JSON: ${res.bodyText.slice(0, 200)}`
      );
    }
  }

  /** Probe session: one-row list_ask_threads (read-only). */
  async assertLoggedIn(): Promise<void> {
    const session = await this.cdp.fetch(ENDPOINTS.SESSION, { method: 'GET' });
    if (session.status === 200) {
      try {
        const j = JSON.parse(session.bodyText) as { user?: unknown };
        if (j && j.user) return;
      } catch {
        // fall through to list probe
      }
    }
    // Some builds omit /api/auth/session user; list endpoint is the real check.
    await this.requestJson<ThreadListItem[]>(ENDPOINTS.LIST_ASK_THREADS, {
      method: 'POST',
      body: {
        limit: 1,
        ascending: false,
        offset: 0,
        search_term: '',
        exclude_asi: false,
        include_assets: false,
      } satisfies ThreadListRequest,
    });
  }

  async listAllThreads(
    onProgress?: (fetched: number) => void
  ): Promise<PerplexityConversationItem[]> {
    const limit = 50;
    let offset = 0;
    const seen = new Set<string>();
    const out: PerplexityConversationItem[] = [];

    for (;;) {
      const page = await this.requestJson<ThreadListItem[]>(
        ENDPOINTS.LIST_ASK_THREADS,
        {
          method: 'POST',
          body: {
            limit,
            ascending: false,
            offset,
            search_term: '',
            exclude_asi: false,
            include_assets: true,
          } satisfies ThreadListRequest,
        }
      );

      if (!Array.isArray(page) || page.length === 0) break;

      let newCount = 0;
      for (const item of page) {
        if (!item?.uuid || seen.has(item.uuid)) continue;
        seen.add(item.uuid);
        newCount++;
        out.push(listItemToConversation(item));
      }
      onProgress?.(out.length);

      if (newCount === 0 || page.length < limit) break;
      offset += page.length;
    }

    return out;
  }

  async getThreadDetail(
    listMeta: PerplexityConversationItem
  ): Promise<PerplexityConversationDetail> {
    const entries: ThreadEntry[] = [];
    const seen = new Set<string>();
    let cursor = '';
    let firstPage: ThreadDetailResponse | null = null;
    const seenCursors = new Set<string>();

    for (;;) {
      const page = await this.requestJson<ThreadDetailResponse>(
        ENDPOINTS.THREAD(listMeta.id, cursor || undefined)
      );
      if (!firstPage) firstPage = page;

      for (const e of page.entries ?? []) {
        if (!e?.uuid || seen.has(e.uuid)) continue;
        seen.add(e.uuid);
        entries.push(e);
      }

      if (!page.has_next_page || !page.next_cursor) break;
      if (seenCursors.has(page.next_cursor)) {
        if (this.verbose) {
          console.error(
            `[perplexity] pagination loop on ${listMeta.id}; stopping`
          );
        }
        break;
      }
      seenCursors.add(page.next_cursor);
      cursor = page.next_cursor;
    }

    return threadToDetail(listMeta, firstPage ?? {}, entries);
  }

  async exportAll(
    options: {
      onListProgress?: (fetched: number) => void;
      onDownloadProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<PerplexityExportBundle> {
    const warnings: string[] = [];
    const conversations = await this.listAllThreads(options.onListProgress);
    const details: PerplexityConversationDetail[] = [];
    let completed = 0;

    for (const item of conversations) {
      try {
        details.push(await this.getThreadDetail(item));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`thread ${item.id}: ${msg}`);
        if (this.verbose) console.error(`[perplexity] ${msg}`);
      }
      completed++;
      options.onDownloadProgress?.(completed, conversations.length);
    }

    return { conversations, details, warnings };
  }
}
