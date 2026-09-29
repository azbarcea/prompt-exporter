import {
  activateCdpTarget,
  discoverCdpPort,
  isCdpRunning,
  isCopilotUrl,
  listCdpTargets,
  openCdpTab,
  type CdpTarget,
} from '../../../utils/cdp.js';
import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';
import {
  COPILOT_CLIENT_ID,
  COPILOT_HOME,
  DEFAULT_VARIANTS,
  SUBSTRATE_BASE,
} from './endpoints.js';
import type {
  CopilotConversationRaw,
  CopilotGetChatsResponse,
} from './types.js';

type JsonObject = Record<string, unknown>;

/**
 * Installs window.__peCopilot on the M365 Copilot Chat page:
 * MSAL token decrypt (browser crypto + cookies) + Substrate GetChats/GetConversation.
 */
const BRIDGE_SOURCE = `(() => {
  if (window.__peCopilot && window.__peCopilot.version === 1) {
    return { ok: true, already: true };
  }

  const CLIENT_ID = ${JSON.stringify(COPILOT_CLIENT_ID)};
  const SUBSTRATE = ${JSON.stringify(SUBSTRATE_BASE)};
  const VARIANTS = ${JSON.stringify(DEFAULT_VARIANTS)};

  const getCookie = (key) =>
    document.cookie.match('(^|;)\\\\s*' + key + '\\\\s*=\\\\s*([^;]+)')?.pop() || '';

  function base64DecToArr(base64String) {
    let s = base64String.replace(/-/g, '+').replace(/_/g, '/');
    switch (s.length % 4) {
      case 2: s += '=='; break;
      case 3: s += '='; break;
    }
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.codePointAt(0) || 0);
  }

  function toArrayBuffer(bufferLike) {
    return Uint8Array.from(bufferLike).buffer;
  }

  async function deriveKey(baseKey, nonce, context) {
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        salt: toArrayBuffer(nonce),
        hash: 'SHA-256',
        info: new TextEncoder().encode(context),
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function decryptPayload(baseKey, nonce, context, encryptedData) {
    const encoded = base64DecToArr(encryptedData);
    const derived = await deriveKey(baseKey, base64DecToArr(nonce), context);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      derived,
      toArrayBuffer(encoded)
    );
    return new TextDecoder().decode(decrypted);
  }

  async function getEncryptionCookie() {
    const raw = decodeURIComponent(getCookie('msal.cache.encryption'));
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Failed to parse msal.cache.encryption cookie');
    }
    if (!parsed?.key || !parsed?.id) {
      throw new Error('No msal.cache.encryption cookie found — log in at m365.cloud.microsoft/chat');
    }
    return {
      id: parsed.id,
      key: await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(base64DecToArr(parsed.key)),
        'HKDF',
        false,
        ['deriveKey']
      ),
    };
  }

  function getMsalIds() {
    const el = document.getElementById('identity');
    if (el?.textContent) {
      try {
        const { objectId, tenantId } = JSON.parse(el.textContent);
        if (objectId && tenantId) {
          return {
            localAccountId: objectId,
            tenantId,
            homeAccountId: objectId + '.' + tenantId,
            clientId: CLIENT_ID,
          };
        }
      } catch { /* fall through */ }
    }

    const keysRaw = localStorage.getItem('msal.3.account.keys');
    if (!keysRaw) {
      throw new Error(
        'No MSAL account on this page. Open https://m365.cloud.microsoft/chat and sign in, then retry.'
      );
    }
    const accountKeys = JSON.parse(keysRaw);
    if (!Array.isArray(accountKeys) || accountKeys.length === 0) {
      throw new Error('MSAL account keys empty — sign in to M365 Copilot Chat');
    }
    const parts = String(accountKeys[0]).split('|');
    const homeAccountId = parts[0] || '';
    const tenantId = parts[2] || '';
    const localAccountId = homeAccountId.split('.')[0] || '';
    if (!localAccountId || !tenantId) {
      throw new Error('Could not parse MSAL homeAccountId / tenantId');
    }
    return { localAccountId, tenantId, homeAccountId, clientId: CLIENT_ID };
  }

  async function decryptAccessToken(msalIds, storedJson) {
    const cookie = await getEncryptionCookie();
    const payload = JSON.parse(storedJson);
    const decrypted = await decryptPayload(
      cookie.key,
      payload.nonce,
      msalIds.clientId,
      payload.data
    );
    return JSON.parse(decrypted).secret;
  }

  async function getAccessToken(msalIds) {
    const scopes = ['https://substrate.office.com/sydney/.default'];
    const directKey =
      msalIds.homeAccountId +
      '-login.windows.net-accesstoken-' +
      msalIds.clientId +
      '-' +
      msalIds.tenantId +
      '-' +
      scopes.join(' ') +
      '--';
    const direct = localStorage.getItem(directKey);
    if (direct) return decryptAccessToken(msalIds, direct);

    const tokenKeysRaw = localStorage.getItem('msal.3.token.keys.' + msalIds.clientId);
    if (!tokenKeysRaw) {
      throw new Error(
        'No MSAL access token for Copilot. Refresh https://m365.cloud.microsoft/chat after signing in.'
      );
    }
    const tokenKeys = JSON.parse(tokenKeysRaw);
    const sydneyKey = (tokenKeys.accessToken || []).find((t) =>
      String(t).includes('https://substrate.office.com/sydney/.default')
    );
    if (!sydneyKey) {
      throw new Error('No Sydney (.default) access token in MSAL cache');
    }
    const entry = localStorage.getItem(sydneyKey);
    if (!entry) throw new Error('Sydney token entry missing from localStorage');
    return decryptAccessToken(msalIds, entry);
  }

  async function ensureAuth() {
    if (window.__peCopilotAuth && window.__peCopilotAuth.token) {
      return window.__peCopilotAuth;
    }
    const msalIds = getMsalIds();
    const token = await getAccessToken(msalIds);
    window.__peCopilotAuth = { token, ...msalIds };
    return window.__peCopilotAuth;
  }

  async function substrateGet(endpoint, params, includeVariants) {
    const auth = await ensureAuth();
    const requestJson = JSON.stringify(params);
    const variantsSuffix = includeVariants
      ? '&variants=' + encodeURIComponent(VARIANTS)
      : '';
    const url =
      SUBSTRATE +
      '/' +
      endpoint +
      '?request=' +
      encodeURIComponent(requestJson) +
      variantsSuffix;
    const headers = {
      authorization: 'Bearer ' + auth.token,
      'content-type': 'application/json',
      'x-anchormailbox': 'Oid:' + auth.localAccountId + '@' + auth.tenantId,
      'x-clientrequestid': crypto.randomUUID().replace(/-/g, ''),
      'x-routingparameter-sessionkey': auth.localAccountId,
      'x-scenario': 'OfficeWebIncludedCopilot',
    };
    const resp = await fetch(url, { method: 'GET', headers });
    const text = await resp.text();
    if (resp.status === 401 || resp.status === 403) {
      window.__peCopilotAuth = null;
      throw new Error(
        endpoint + ' returned ' + resp.status + ' — session expired; refresh the Copilot tab and retry'
      );
    }
    if (!resp.ok) {
      throw new Error(
        endpoint + ' returned ' + resp.status + ': ' + text.slice(0, 200)
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(endpoint + ' returned non-JSON');
    }
  }

  window.__peCopilot = {
    version: 1,
    async ping() {
      const auth = await ensureAuth();
      return {
        ok: true,
        localAccountId: auth.localAccountId,
        tenantId: auth.tenantId,
      };
    },
    async getChats(syncState) {
      const params = {
        source: 'officeweb',
        traceId: crypto.randomUUID(),
        threadType: 'bizchat',
        MaxReturnedChatsCount: 50,
        mergeWorkWebChats: true,
        includeChatsWithHarmfulContentProtectionDisabled: true,
      };
      if (syncState) params.syncState = syncState;
      return substrateGet('GetChats', params, true);
    },
    async getConversation(conversationId) {
      return substrateGet(
        'GetConversation',
        {
          conversationId,
          source: 'officeweb',
          traceId: crypto.randomUUID().replace(/-/g, ''),
        },
        false
      );
    },
  };

  return { ok: true, already: false };
})()`;

function getWebSocket(): typeof WebSocket {
  const WS = globalThis.WebSocket;
  if (!WS) {
    throw new Error(
      'WebSocket is not available in this Node runtime (need Node 22+)'
    );
  }
  return WS;
}

export class CopilotCdpSession {
  private port: number;
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: JsonObject) => void; reject: (e: Error) => void }
  >();
  private minGapMs: number;
  private lastStartAt = 0;

  private constructor(
    port: number,
    ws: WebSocket,
    options: { minGapMs?: number } = {}
  ) {
    this.port = port;
    this.ws = ws;
    this.minGapMs = Math.max(0, options.minGapMs ?? 400);
    this.ws.addEventListener('message', (event) => {
      const raw =
        typeof event.data === 'string' ? event.data : String(event.data);
      let msg: JsonObject;
      try {
        msg = JSON.parse(raw) as JsonObject;
      } catch {
        return;
      }
      const id = msg.id;
      if (typeof id !== 'number') return;
      const waiter = this.pending.get(id);
      if (!waiter) return;
      this.pending.delete(id);
      if (msg.error) {
        const err = msg.error as JsonObject;
        waiter.reject(
          new Error(
            typeof err.message === 'string' ? err.message : 'CDP error'
          )
        );
      } else {
        waiter.resolve((msg.result as JsonObject) ?? {});
      }
    });
  }

  get debuggingPort(): number {
    return this.port;
  }

  static async connect(
    preferredPort: number = DEFAULT_CDP_PORT,
    options: { minGapMs?: number } = {}
  ): Promise<CopilotCdpSession> {
    let port = preferredPort;
    if (!(await isCdpRunning(port))) {
      const found = await discoverCdpPort(port);
      if (found === null) {
        throw new Error(
          `No Chromium CDP endpoint found. Start with: prompt-exporter chromium start --url ${COPILOT_HOME}`
        );
      }
      port = found;
    }

    const target = await pickOrOpenCopilotPage(port);
    await activateCdpTarget(port, target.id);
    if (!target.webSocketDebuggerUrl) {
      throw new Error('CDP target missing webSocketDebuggerUrl');
    }

    const WS = getWebSocket();
    const ws = new WS(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('CDP WebSocket connect timeout')),
        10000
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

    const session = new CopilotCdpSession(port, ws, options);
    await session.send('Runtime.enable');
    await session.send('Page.enable').catch(() => undefined);
    // Give a freshly opened tab a moment to load MSAL cache
    await new Promise((r) => setTimeout(r, 1500));
    await session.installBridge();
    await session.ping();
    return session;
  }

  async close(): Promise<void> {
    for (const [, waiter] of this.pending) {
      waiter.reject(new Error('CDP session closed'));
    }
    this.pending.clear();
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }

  private send(
    method: string,
    params?: JsonObject
  ): Promise<JsonObject> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private async evaluate<T>(expression: string): Promise<T> {
    const gap = this.minGapMs - (Date.now() - this.lastStartAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    this.lastStartAt = Date.now();

    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    const remote = result.result as JsonObject | undefined;
    if (result.exceptionDetails) {
      const ex = result.exceptionDetails as JsonObject;
      const desc =
        (ex.exception as JsonObject | undefined)?.description ||
        ex.text ||
        'Runtime.evaluate failed';
      throw new Error(String(desc));
    }
    if (remote?.subtype === 'error') {
      throw new Error(
        String(remote.description || remote.value || 'evaluate error')
      );
    }
    return remote?.value as T;
  }

  private async installBridge(): Promise<void> {
    const res = await this.evaluate<{ ok?: boolean }>(BRIDGE_SOURCE);
    if (!res?.ok) {
      throw new Error('Failed to install Copilot CDP bridge on the page');
    }
  }

  async ping(): Promise<{ localAccountId: string; tenantId: string }> {
    const res = await this.evaluate<{
      ok?: boolean;
      localAccountId?: string;
      tenantId?: string;
    }>('window.__peCopilot.ping()');
    if (!res?.ok || !res.localAccountId || !res.tenantId) {
      throw new Error(
        `Not authenticated to M365 Copilot Chat. Open ${COPILOT_HOME}, sign in, then retry.`
      );
    }
    return { localAccountId: res.localAccountId, tenantId: res.tenantId };
  }

  async getChats(syncState?: string | null): Promise<CopilotGetChatsResponse> {
    const arg = syncState == null ? 'null' : JSON.stringify(syncState);
    return this.evaluate<CopilotGetChatsResponse>(
      `window.__peCopilot.getChats(${arg})`
    );
  }

  async getConversation(
    conversationId: string
  ): Promise<CopilotConversationRaw> {
    return this.evaluate<CopilotConversationRaw>(
      `window.__peCopilot.getConversation(${JSON.stringify(conversationId)})`
    );
  }
}

async function pickOrOpenCopilotPage(port: number): Promise<CdpTarget> {
  const targets = await listCdpTargets(port);
  const pages = targets.filter(
    (t) => t.type === 'page' && t.webSocketDebuggerUrl
  );
  const existing = pages.find((t) => isCopilotUrl(t.url));
  if (existing) return existing;
  return openCdpTab(port, COPILOT_HOME);
}
