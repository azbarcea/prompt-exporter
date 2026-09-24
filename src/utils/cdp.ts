import { DEFAULT_CDP_PORT } from './paths.js';

export interface CdpEndpointInfo {
  port: number;
  webSocketDebuggerUrl?: string;
  Browser?: string;
  'Protocol-Version'?: string;
}

export interface CdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

type JsonObject = Record<string, unknown>;

async function cdpHttp<T>(
  port: number,
  path: string,
  options: { timeoutMs?: number; method?: string; allowPlainText?: boolean } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const url = `http://127.0.0.1:${port}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`CDP HTTP ${response.status} for ${path}`);
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      if (options.allowPlainText) {
        return text as T;
      }
      throw new Error(`CDP HTTP non-JSON response for ${path}: ${text.slice(0, 80)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return true if something already answers on the Chromium DevTools HTTP endpoint.
 * Uses /json/version (standard CDP discovery).
 */
export async function isCdpRunning(
  port: number = DEFAULT_CDP_PORT,
  options: { timeoutMs?: number } = {}
): Promise<boolean> {
  const info = await getCdpEndpointInfo(port, options);
  return info !== null;
}

/**
 * Find a live CDP port. Order: explicit env, preferred, then common ports.
 */
export async function discoverCdpPort(
  preferred: number = DEFAULT_CDP_PORT
): Promise<number | null> {
  const fromEnv = (process.env.PROMPT_EXPORTER_CDP_PORT || process.env.CHATGPT_EXPORTER_CDP_PORT)?.trim();
  const candidates = [
    fromEnv ? Number.parseInt(fromEnv, 10) : NaN,
    preferred,
    9222,
    9223,
    9229,
    9333,
  ].filter((n) => Number.isFinite(n) && n > 0 && n <= 65535);

  const seen = new Set<number>();
  for (const port of candidates) {
    if (seen.has(port)) continue;
    seen.add(port);
    if (await isCdpRunning(port)) return port;
  }
  return null;
}


export async function getCdpEndpointInfo(
  port: number = DEFAULT_CDP_PORT,
  options: { timeoutMs?: number } = {}
): Promise<CdpEndpointInfo | null> {
  try {
    const data = await cdpHttp<JsonObject>(port, '/json/version', options);
    return {
      port,
      webSocketDebuggerUrl:
        typeof data.webSocketDebuggerUrl === 'string'
          ? data.webSocketDebuggerUrl
          : undefined,
      Browser: typeof data.Browser === 'string' ? data.Browser : undefined,
      'Protocol-Version':
        typeof data['Protocol-Version'] === 'string'
          ? data['Protocol-Version']
          : undefined,
    };
  } catch {
    return null;
  }
}

export function isChatGptUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'chatgpt.com' ||
      parsed.hostname === 'www.chatgpt.com' ||
      parsed.hostname === 'chat.openai.com'
    );
  } catch {
    return false;
  }
}

export function isLumoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'lumo.proton.me' ||
      parsed.hostname.endsWith('.lumo.proton.me')
    );
  } catch {
    return false;
  }
}

function parseTarget(raw: JsonObject): CdpTarget | null {
  if (typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    type: typeof raw.type === 'string' ? raw.type : 'unknown',
    title: typeof raw.title === 'string' ? raw.title : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    webSocketDebuggerUrl:
      typeof raw.webSocketDebuggerUrl === 'string'
        ? raw.webSocketDebuggerUrl
        : undefined,
  };
}

export async function listCdpTargets(port: number): Promise<CdpTarget[]> {
  const data = await cdpHttp<unknown>(port, '/json/list');
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseTarget(item as JsonObject))
    .filter((t): t is CdpTarget => t !== null);
}

export async function openCdpTab(port: number, url: string): Promise<CdpTarget> {
  // Chromium accepts GET /json/new?<url>
  const path = `/json/new?${encodeURIComponent(url)}`;
  const data = await cdpHttp<JsonObject>(port, path, { method: 'PUT' }).catch(
    async () => cdpHttp<JsonObject>(port, path)
  );
  const target = parseTarget(data);
  if (!target) {
    throw new Error('CDP /json/new did not return a target');
  }
  return target;
}

export async function activateCdpTarget(port: number, id: string): Promise<void> {
  // Chromium returns plain text "Target activated", not JSON.
  await cdpHttp<unknown>(port, `/json/activate/${encodeURIComponent(id)}`, {
    allowPlainText: true,
  });
}

function getWebSocket(): typeof WebSocket {
  const WS = globalThis.WebSocket;
  if (!WS) {
    throw new Error(
      'WebSocket is not available in this Node runtime (need Node 22+ or a WebSocket polyfill)'
    );
  }
  return WS;
}

export async function withCdpSocket<T>(
  webSocketDebuggerUrl: string,
  fn: (send: (method: string, params?: JsonObject) => Promise<JsonObject>) => Promise<T>
): Promise<T> {
  const WS = getWebSocket();
  const ws = new WS(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: JsonObject) => void; reject: (e: Error) => void }
  >();

  const send = (method: string, params?: JsonObject): Promise<JsonObject> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout')), 5000);
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
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      let msg: JsonObject;
      try {
        msg = JSON.parse(raw) as JsonObject;
      } catch {
        return;
      }
      const id = msg.id;
      if (typeof id !== 'number') return;
      const waiter = pending.get(id);
      if (!waiter) return;
      pending.delete(id);
      if (msg.error) {
        const err = msg.error as JsonObject;
        waiter.reject(
          new Error(typeof err.message === 'string' ? err.message : 'CDP error')
        );
      } else {
        waiter.resolve((msg.result as JsonObject) ?? {});
      }
    });

    return await fn(send);
  } finally {
    for (const [, waiter] of pending) {
      waiter.reject(new Error('CDP WebSocket closed'));
    }
    pending.clear();
    ws.close();
  }
}

export async function cdpNavigate(
  webSocketDebuggerUrl: string,
  url: string
): Promise<void> {
  const WS = getWebSocket();
  const ws = new WS(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: JsonObject) => void; reject: (e: Error) => void }
  >();

  const send = (method: string, params?: JsonObject): Promise<JsonObject> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout')), 5000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket connection failed'));
      });
    });

    let loadResolve: (() => void) | undefined;
    const loadPromise = new Promise<void>((resolve) => {
      loadResolve = resolve;
    });

    ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      let msg: JsonObject;
      try {
        msg = JSON.parse(raw) as JsonObject;
      } catch {
        return;
      }
      if (msg.method === 'Page.loadEventFired') {
        loadResolve?.();
      }
      const id = msg.id;
      if (typeof id !== 'number') return;
      const waiter = pending.get(id);
      if (!waiter) return;
      pending.delete(id);
      if (msg.error) {
        const err = msg.error as JsonObject;
        waiter.reject(
          new Error(typeof err.message === 'string' ? err.message : 'CDP error')
        );
      } else {
        waiter.resolve((msg.result as JsonObject) ?? {});
      }
    });

    await send('Page.enable');
    await send('Page.navigate', { url });
    await Promise.race([
      loadPromise,
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    // Small settle time for client-rendered JSON
    await new Promise((r) => setTimeout(r, 300));
  } finally {
    for (const [, waiter] of pending) {
      waiter.reject(new Error('CDP WebSocket closed'));
    }
    pending.clear();
    ws.close();
  }
}

/**
 * Prefer an existing chatgpt.com tab (reuse login cookies); otherwise open a new tab
 * in the same CDP browser. Navigates that tab to sessionUrl.
 */
export async function ensureChatGptSessionTab(
  port: number,
  sessionUrl: string
): Promise<{ target: CdpTarget; reused: boolean }> {
  const targets = await listCdpTargets(port);
  const pages = targets.filter((t) => t.type === 'page' || t.type === 'tab');
  const existing =
    pages.find((t) => t.url.startsWith(sessionUrl)) ??
    pages.find((t) => isChatGptUrl(t.url));

  if (existing) {
    await activateCdpTarget(port, existing.id);
    if (existing.webSocketDebuggerUrl && existing.url !== sessionUrl) {
      await cdpNavigate(existing.webSocketDebuggerUrl, sessionUrl);
      // Refresh target metadata after navigate
      const refreshed = (await listCdpTargets(port)).find((t) => t.id === existing.id);
      return { target: refreshed ?? existing, reused: true };
    }
    if (existing.url !== sessionUrl) {
      // No WS URL — open session in a new tab of the same browser
      const created = await openCdpTab(port, sessionUrl);
      return { target: created, reused: true };
    }
    return { target: existing, reused: true };
  }

  const created = await openCdpTab(port, sessionUrl);
  return { target: created, reused: false };
}

/**
 * Read accessToken from the session page / via in-page fetch (same cookie jar).
 */
export async function extractAccessTokenViaCdp(
  webSocketDebuggerUrl: string,
  options: { attempts?: number; delayMs?: number } = {}
): Promise<string | null> {
  const attempts = options.attempts ?? 5;
  const delayMs = options.delayMs ?? 400;

  return withCdpSocket(webSocketDebuggerUrl, async (send) => {
    await send('Runtime.enable');

    for (let i = 0; i < attempts; i++) {
      const result = await send('Runtime.evaluate', {
        expression: `(() => {
          const readBody = () => {
            const text = document.body && document.body.innerText;
            if (!text) return null;
            try {
              const parsed = JSON.parse(text.trim());
              if (parsed && typeof parsed.accessToken === 'string') return parsed.accessToken;
            } catch {}
            return null;
          };
          const fromBody = readBody();
          if (fromBody) return Promise.resolve(fromBody);
          return fetch('https://chatgpt.com/api/auth/session', { credentials: 'include' })
            .then((r) => r.json())
            .then((j) => (j && typeof j.accessToken === 'string' ? j.accessToken : null))
            .catch(() => null);
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });

      const remote = result.result as JsonObject | undefined;
      const value = remote?.value;
      if (typeof value === 'string' && value.startsWith('eyJ')) {
        return value;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  });
}
