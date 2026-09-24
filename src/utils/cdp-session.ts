import {
  activateCdpTarget,
  cdpNavigate,
  ensureChatGptSessionTab,
  listCdpTargets,
  openCdpTab,
  type CdpTarget,
} from './cdp.js';

export const SESSION_URL = 'https://chatgpt.com/api/auth/session';
export const APP_URL = 'https://chatgpt.com/';

export type SessionProbe = {
  accessToken: string | null;
  loggedIn: boolean;
  /** True when /api/auth/session returned only the warning banner (anonymous). */
  anonymousBannerOnly: boolean;
  keys: string[];
  error?: string;
};

type JsonObject = Record<string, unknown>;

function getWebSocket(): typeof WebSocket {
  const WS = globalThis.WebSocket;
  if (!WS) {
    throw new Error(
      'WebSocket is not available in this Node runtime (need Node 22+ or a WebSocket polyfill)'
    );
  }
  return WS;
}

async function withCdpSocket<T>(
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
      const timer = setTimeout(
        () => reject(new Error('CDP WebSocket connect timeout')),
        5000
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

function normalizeProbe(raw: unknown): SessionProbe {
  if (!raw || typeof raw !== 'object') {
    return {
      accessToken: null,
      loggedIn: false,
      anonymousBannerOnly: false,
      keys: [],
      error: 'empty session payload',
    };
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const token =
    typeof obj.accessToken === 'string'
      ? obj.accessToken
      : typeof obj.access_token === 'string'
        ? obj.access_token
        : null;
  const validToken = token && token.startsWith('eyJ') ? token : null;
  const anonymousBannerOnly =
    !validToken && keys.length === 1 && keys[0] === 'WARNING_BANNER';
  return {
    accessToken: validToken,
    loggedIn: Boolean(validToken),
    anonymousBannerOnly,
    keys,
  };
}

/** Probe /api/auth/session inside a page (same cookie jar). */
export async function probeSessionViaCdp(
  webSocketDebuggerUrl: string
): Promise<SessionProbe> {
  try {
    return await withCdpSocket(webSocketDebuggerUrl, async (send) => {
      await send('Runtime.enable');
      const result = await send('Runtime.evaluate', {
        expression: `(() => {
          const tryParse = (text) => {
            if (!text || typeof text !== 'string') return null;
            const trimmed = text.trim();
            try { return JSON.parse(trimmed); } catch {}
            // Pretty-printed / viewer noise: pull accessToken via regex
            const m = trimmed.match(/"accessToken"\\s*:\\s*"(eyJ[^"]+)"/);
            if (m) return { accessToken: m[1], __via: 'regex' };
            return null;
          };

          const candidates = [];
          if (document.body && document.body.innerText) candidates.push(document.body.innerText);
          if (document.body && document.body.textContent) candidates.push(document.body.textContent);
          const pre = document.querySelector('pre');
          if (pre && pre.textContent) candidates.push(pre.textContent);
          // Chrome JSON viewer / plain document
          const html = document.documentElement ? document.documentElement.innerText : '';
          if (html) candidates.push(html);

          for (const c of candidates) {
            const parsed = tryParse(c);
            if (parsed && parsed.accessToken) return Promise.resolve(parsed);
          }

          return fetch('/api/auth/session', {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          })
            .then(async (r) => {
              const text = await r.text();
              const parsed = tryParse(text);
              if (parsed) return parsed;
              try { return JSON.parse(text); } catch {
                return { __error: 'unparseable session response', __preview: text.slice(0, 120) };
              }
            })
            .catch((e) => ({ __error: String(e) }));
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      const value = (result.result as JsonObject | undefined)?.value;
      if (value && typeof value === 'object' && '__error' in (value as object)) {
        return {
          accessToken: null,
          loggedIn: false,
          anonymousBannerOnly: false,
          keys: [],
          error: String((value as JsonObject).__error),
        };
      }
      return normalizeProbe(value);
    });
  } catch (error) {
    return {
      accessToken: null,
      loggedIn: false,
      anonymousBannerOnly: false,
      keys: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureChatGptAppTab(port: number): Promise<CdpTarget> {
  const targets = await listCdpTargets(port);
  const pages = targets.filter((t) => t.type === 'page' || t.type === 'tab');
  const existing = pages.find(
    (t) =>
      t.url === APP_URL ||
      t.url.startsWith('https://chatgpt.com/?') ||
      t.url.startsWith('https://chatgpt.com/c/') ||
      t.url.startsWith('https://chatgpt.com/g/')
  );
  if (existing?.webSocketDebuggerUrl) {
    await activateCdpTarget(port, existing.id);
    return existing;
  }
  if (existing) {
    await activateCdpTarget(port, existing.id);
    return existing;
  }
  return openCdpTab(port, APP_URL);
}

/**
 * Resolve a page WS URL suitable for session probing: prefer session tab,
 * else any chatgpt tab, ensuring navigation to SESSION_URL when needed.
 */
export async function prepareSessionTarget(port: number): Promise<{
  target: CdpTarget;
  reused: boolean;
  probe: SessionProbe;
}> {
  const { target, reused } = await ensureChatGptSessionTab(port, SESSION_URL);

  // Always re-list: WS URL / url can change after activate/open
  const refreshed =
    (await listCdpTargets(port)).find((t) => t.id === target.id) ?? target;
  let wsUrl = refreshed.webSocketDebuggerUrl;
  if (!wsUrl) {
    return {
      target: refreshed,
      reused,
      probe: {
        accessToken: null,
        loggedIn: false,
        anonymousBannerOnly: false,
        keys: [],
        error: 'No DevTools WebSocket for tab',
      },
    };
  }

  // 1) Read whatever is already on screen first (user may already have full JSON visible)
  let probe = await probeSessionViaCdp(wsUrl);
  if (probe.loggedIn) {
    return { target: refreshed, reused, probe };
  }

  // 2) Navigate to session URL only if needed, then re-probe
  if (!refreshed.url.startsWith(SESSION_URL)) {
    await cdpNavigate(wsUrl, SESSION_URL);
    const afterNav =
      (await listCdpTargets(port)).find((t) => t.id === refreshed.id) ?? refreshed;
    wsUrl = afterNav.webSocketDebuggerUrl ?? wsUrl;
    probe = await probeSessionViaCdp(wsUrl);
    if (probe.loggedIn) {
      return { target: afterNav, reused, probe };
    }
  }

  // 3) Last resort: in-page fetch already tried inside probe; one reload
  await cdpNavigate(wsUrl, SESSION_URL);
  const afterReload =
    (await listCdpTargets(port)).find((t) => t.id === refreshed.id) ?? refreshed;
  wsUrl = afterReload.webSocketDebuggerUrl ?? wsUrl;
  // Give Chrome JSON viewer a moment to paint
  await new Promise((r) => setTimeout(r, 400));
  probe = await probeSessionViaCdp(wsUrl);

  return { target: afterReload, reused, probe };
}

/** Poll until accessToken appears or timeout. */
export async function waitForAccessToken(
  port: number,
  options: { timeoutMs?: number; intervalMs?: number; onTick?: (probe: SessionProbe) => void } = {}
): Promise<SessionProbe> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const intervalMs = options.intervalMs ?? 2000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { probe } = await prepareSessionTarget(port);
    options.onTick?.(probe);
    if (probe.loggedIn && probe.accessToken) {
      return probe;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const last = await prepareSessionTarget(port);
  return last.probe;
}
