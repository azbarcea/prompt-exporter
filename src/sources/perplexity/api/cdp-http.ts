import {
  activateCdpTarget,
  discoverCdpPort,
  isCdpRunning,
  isPerplexityUrl,
  listCdpTargets,
  openCdpTab,
  type CdpTarget,
} from '../../../utils/cdp.js';
import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';
import { ThrottleStats } from '../../../utils/throttle-stats.js';
import { BASE_URL } from './endpoints.js';

type JsonObject = Record<string, unknown>;

export type CdpHttpResponse = {
  status: number;
  statusText: string;
  bodyText: string;
};

type Worker = {
  id: number;
  targetId: string;
  ws: WebSocket;
  nextId: number;
  pending: Map<
    number,
    { resolve: (v: JsonObject) => void; reject: (e: Error) => void }
  >;
  busy: boolean;
};

/**
 * CDP tab pool that runs fetch() on perplexity.ai (cookies + Cloudflare).
 * Data path is still Perplexity's REST API — CDP is transport/auth only.
 */
export class PerplexityCdpHttp {
  private port: number;
  private poolSize: number;
  private workers: Worker[] = [];
  private waiters: Array<(w: Worker) => void> = [];
  private connecting: Promise<void> | null = null;
  readonly stats = new ThrottleStats();
  private cooldownMs = 0;
  private minGapMs: number;
  private lastStartAt = 0;

  constructor(
    port: number,
    options: { poolSize?: number; minGapMs?: number } = {}
  ) {
    this.port = port;
    this.poolSize = Math.max(1, options.poolSize ?? 3);
    this.minGapMs = Math.max(0, options.minGapMs ?? 200);
  }

  get debuggingPort(): number {
    return this.port;
  }

  get workerCount(): number {
    return this.workers.length;
  }

  static async connect(
    preferredPort: number = DEFAULT_CDP_PORT,
    options: { poolSize?: number; minGapMs?: number } = {}
  ): Promise<PerplexityCdpHttp> {
    let port = preferredPort;
    if (!(await isCdpRunning(port))) {
      const found = await discoverCdpPort(port);
      if (found === null) {
        throw new Error(
          'No Chromium CDP endpoint found. Start with: prompt-exporter chromium start --url https://www.perplexity.ai/'
        );
      }
      port = found;
    }
    const session = new PerplexityCdpHttp(port, options);
    await session.ensurePool();
    return session;
  }

  async close(): Promise<void> {
    for (const w of this.workers) {
      for (const [, waiter] of w.pending) {
        waiter.reject(new Error('CDP session closed'));
      }
      w.pending.clear();
      try {
        w.ws.close();
      } catch {
        // ignore
      }
    }
    this.workers = [];
    this.waiters = [];
    this.connecting = null;
  }

  private async ensurePool(): Promise<void> {
    if (this.workers.length >= this.poolSize) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const pages = await this.pickOrOpenPages(this.poolSize);
      for (let i = 0; i < pages.length; i++) {
        if (this.workers.some((w) => w.targetId === pages[i]!.id)) continue;
        const worker = await this.attachWorker(i, pages[i]!);
        this.workers.push(worker);
      }
      if (this.workers.length === 0) {
        throw new Error('Failed to attach any Perplexity CDP page workers');
      }
    })();

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async pickOrOpenPages(n: number): Promise<CdpTarget[]> {
    const targets = await listCdpTargets(this.port);
    const pages = targets.filter((t) => t.type === 'page' || t.type === 'tab');
    const pplx = pages.filter((t) => isPerplexityUrl(t.url));
    const chosen: CdpTarget[] = [...pplx];

    while (chosen.length < n) {
      const created = await openCdpTab(this.port, BASE_URL + '/');
      chosen.push(created);
      await new Promise((r) => setTimeout(r, 500));
    }

    return chosen.slice(0, n);
  }

  private async attachWorker(id: number, page: CdpTarget): Promise<Worker> {
    await activateCdpTarget(this.port, page.id);
    const refreshed =
      (await listCdpTargets(this.port)).find((t) => t.id === page.id) ?? page;
    const wsUrl = refreshed.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('CDP page has no webSocketDebuggerUrl');

    const WS = globalThis.WebSocket;
    if (!WS) throw new Error('WebSocket not available');

    const ws = new WS(wsUrl);
    const worker: Worker = {
      id,
      targetId: page.id,
      ws,
      nextId: 1,
      pending: new Map(),
      busy: false,
    };

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('CDP WebSocket connect timeout')),
        8000
      );
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket connection failed'));
      });
    });

    ws.addEventListener('message', (event) => {
      const raw =
        typeof event.data === 'string' ? event.data : String(event.data);
      let msg: JsonObject;
      try {
        msg = JSON.parse(raw) as JsonObject;
      } catch {
        return;
      }
      const mid = msg.id;
      if (typeof mid !== 'number') return;
      const waiter = worker.pending.get(mid);
      if (!waiter) return;
      worker.pending.delete(mid);
      if (msg.error) {
        const err = msg.error as JsonObject;
        waiter.reject(
          new Error(typeof err.message === 'string' ? err.message : 'CDP error')
        );
      } else {
        waiter.resolve((msg.result as JsonObject) ?? {});
      }
    });

    await this.send(worker, 'Runtime.enable');
    return worker;
  }

  private send(
    worker: Worker,
    method: string,
    params?: JsonObject
  ): Promise<JsonObject> {
    if (worker.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP WebSocket not open'));
    }
    const id = worker.nextId++;
    return new Promise((resolve, reject) => {
      worker.pending.set(id, { resolve, reject });
      worker.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private acquire(): Promise<Worker> {
    const free = this.workers.find((w) => !w.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private release(worker: Worker): void {
    const next = this.waiters.shift();
    if (next) {
      next(worker);
    } else {
      worker.busy = false;
    }
  }

  private async respectGap(): Promise<void> {
    const gap = Math.max(this.minGapMs, this.cooldownMs);
    if (gap <= 0) return;
    const wait = gap - (Date.now() - this.lastStartAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastStartAt = Date.now();
  }

  async fetch(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {}
  ): Promise<CdpHttpResponse> {
    await this.ensurePool();
    await this.respectGap();

    const worker = await this.acquire();
    const t0 = Date.now();
    try {
      const response = await this.fetchOnWorker(worker, url, options);
      const latency = Date.now() - t0;
      if (response.status === 429) {
        this.stats.recordRateLimit(latency);
        this.cooldownMs = Math.min(
          15_000,
          Math.max(1000, this.cooldownMs * 2 || 1000)
        );
      } else if (response.status >= 200 && response.status < 300) {
        this.stats.recordSuccess(latency);
        this.cooldownMs = Math.floor(this.cooldownMs * 0.5);
      } else {
        this.stats.recordFailure(latency);
      }
      return response;
    } catch (e) {
      this.stats.recordFailure(Date.now() - t0);
      throw e;
    } finally {
      this.release(worker);
    }
  }

  private async fetchOnWorker(
    worker: Worker,
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<CdpHttpResponse> {
    const method = options.method ?? 'GET';
    const extraHeaders = options.headers ?? {};
    const body = options.body;

    const result = await this.send(worker, 'Runtime.evaluate', {
      expression: `(() => {
        const url = ${JSON.stringify(url)};
        const method = ${JSON.stringify(method)};
        const extraHeaders = ${JSON.stringify(extraHeaders)};
        const body = ${JSON.stringify(body ?? null)};

        return (async () => {
          if (!location.hostname.includes('perplexity.ai')) {
            return {
              status: 0,
              statusText: 'wrong-host',
              bodyText: 'Not on perplexity.ai — open https://www.perplexity.ai/ and log in.',
            };
          }
          const response = await fetch(url, {
            method,
            credentials: 'include',
            headers: Object.assign(
              { Accept: 'application/json' },
              extraHeaders || {}
            ),
            body: body == null ? undefined : body,
          });
          const bodyText = await response.text();
          return {
            status: response.status,
            statusText: response.statusText,
            bodyText,
          };
        })();
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const value = (result.result as JsonObject | undefined)?.value as
      | CdpHttpResponse
      | undefined;
    if (!value || typeof value.status !== 'number') {
      throw new Error('CDP fetch returned no usable response');
    }
    return {
      status: value.status,
      statusText: value.statusText,
      bodyText: value.bodyText,
    };
  }
}
