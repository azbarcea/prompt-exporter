import {
  activateCdpTarget,
  discoverCdpPort,
  isCdpRunning,
  isLumoUrl,
  listCdpTargets,
  openCdpTab,
  withCdpSocket,
} from '../../../utils/cdp.js';
import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';
import { LUMO_HOME } from './endpoints.js';
import type {
  LumoConversationDetail,
  LumoConversationItem,
  LumoExportBundle,
} from './types.js';

type JsonObject = Record<string, unknown>;

/**
 * In-page exporter: find Proton Lumo Redux store (decrypted state), pull any
 * conversations missing messages, and return ChatGPT-compatible mapping trees.
 *
 * Lumo encrypts at rest; plaintext lives in the logged-in SPA. We do not call
 * /api/lumo/v1 from Node — only Runtime.evaluate inside lumo.proton.me.
 */
const EXPORT_EXPRESSION = `(() => {
  const PULL_TIMEOUT_MS = 45000;
  const PULL_POLL_MS = 250;
  const INIT_WAIT_MS = 90000;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function findReduxStore() {
    if (window.lumoStore && typeof window.lumoStore.getState === 'function') {
      return window.lumoStore;
    }
    const roots = [
      document.getElementById('root'),
      document.getElementById('app'),
      document.querySelector('[data-testid="lumo-app"]'),
      document.body,
    ].filter(Boolean);

    const tryFiber = (fiber, depth) => {
      if (!fiber || depth > 60) return null;
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props && props.store && typeof props.store.getState === 'function') {
        return props.store;
      }
      if (props && props.value && props.value.store && typeof props.value.store.getState === 'function') {
        return props.value.store;
      }
      let hook = fiber.memoizedState;
      for (let i = 0; hook && i < 80; i++) {
        const ms = hook.memoizedState;
        if (ms && ms.store && typeof ms.store.getState === 'function') return ms.store;
        if (ms && typeof ms.getState === 'function' && typeof ms.dispatch === 'function') return ms;
        hook = hook.next;
      }
      return (
        tryFiber(fiber.child, depth + 1) ||
        tryFiber(fiber.sibling, depth + 1)
      );
    };

    for (const el of roots) {
      const key = Object.keys(el).find(
        (k) => k.startsWith('__reactContainer') || k.startsWith('__reactFiber')
      );
      if (!key) continue;
      let fiber = el[key];
      if (fiber && fiber.stateNode) fiber = fiber.stateNode;
      if (fiber && fiber.child) fiber = fiber.child;
      const store = tryFiber(fiber, 0);
      if (store) return store;
    }
    return null;
  }

  function messageText(m) {
    if (!m) return '';
    if (typeof m.content === 'string' && m.content.trim()) return m.content;
    if (Array.isArray(m.blocks)) {
      return m.blocks
        .filter((b) => b && b.type === 'text' && typeof b.content === 'string')
        .map((b) => b.content)
        .join('\\n')
        .trim();
    }
    return '';
  }

  function roleOf(m) {
    const r = (m && m.role) || 'assistant';
    if (r === 'user' || r === 'assistant' || r === 'system') return r;
    if (r === 'tool_call' || r === 'tool_result') return 'assistant';
    return String(r);
  }

  function toEpoch(iso) {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
  }

  function buildDetail(conversation, messages) {
    const byId = {};
    for (const m of messages) {
      byId[m.id] = m;
    }
    const mapping = {};
    const roots = [];
    for (const m of messages) {
      const parent = m.parentId && byId[m.parentId] ? m.parentId : null;
      mapping[m.id] = {
        id: m.id,
        parent,
        children: [],
        message: {
          id: m.id,
          author: { role: roleOf(m) },
          content: { content_type: 'text', parts: [messageText(m)] },
          create_time: toEpoch(m.createdAt),
        },
      };
      if (!parent) roots.push(m.id);
    }
    for (const m of messages) {
      if (m.parentId && mapping[m.parentId] && mapping[m.id]) {
        mapping[m.parentId].children.push(m.id);
      }
    }
    // synthetic root if needed (ChatGPT-style)
    let current = null;
    if (messages.length) {
      const leaves = messages.filter((m) => !(mapping[m.id].children || []).length);
      const last = leaves.sort((a, b) => toEpoch(a.createdAt) - toEpoch(b.createdAt)).pop();
      current = last ? last.id : messages[messages.length - 1].id;
    }
    if (roots.length === 0 && messages.length) {
      const rootId = 'client-created-root';
      mapping[rootId] = {
        id: rootId,
        parent: null,
        children: messages.filter((m) => !m.parentId).map((m) => m.id),
        message: null,
      };
      for (const m of messages) {
        if (!m.parentId && mapping[m.id]) mapping[m.id].parent = rootId;
      }
    }

    return {
      id: conversation.id,
      title: conversation.title || 'Untitled',
      create_time: toEpoch(conversation.createdAt),
      update_time: toEpoch(conversation.updatedAt || conversation.createdAt),
      space_id: conversation.spaceId,
      starred: !!conversation.starred,
      mapping,
      current_node: current,
    };
  }

  async function waitForStore() {
    const start = Date.now();
    while (Date.now() - start < INIT_WAIT_MS) {
      const store = findReduxStore();
      if (store) {
        const state = store.getState();
        const cred = state.credentials && state.credentials.masterKeyState;
        const convs = state.conversations || {};
        const init = state.initialization;
        const readyCred = cred && (cred.status === 'ready' || cred.status === 'ineligible');
        const hasConvs = Object.keys(convs).length > 0;
        // Allow empty account once credentials ready / init done
        if (readyCred || hasConvs || (init && init.status === 'done')) {
          return store;
        }
      }
      await sleep(400);
    }
    return findReduxStore();
  }

  async function pullConversation(store, id) {
    const before = Object.values(store.getState().messages || {}).filter(
      (m) => m.conversationId === id
    ).length;
    if (before > 0) return;

    store.dispatch({ type: 'lumo/conversation/pullRequest', payload: { id } });
    const start = Date.now();
    while (Date.now() - start < PULL_TIMEOUT_MS) {
      await sleep(PULL_POLL_MS);
      const n = Object.values(store.getState().messages || {}).filter(
        (m) => m.conversationId === id
      ).length;
      if (n > before) return;
    }
  }

  return (async () => {
    if (!location.hostname.includes('lumo.proton.me')) {
      return {
        ok: false,
        error: 'Not on lumo.proton.me — open Lumo in this CDP browser and log in.',
      };
    }
    const store = await waitForStore();
    if (!store) {
      return {
        ok: false,
        error:
          'Could not find Lumo Redux store. Open https://lumo.proton.me/, log in, wait for chats to load, then retry.',
      };
    }

    const warnings = [];
    const state0 = store.getState();
    const cred = state0.credentials && state0.credentials.masterKeyState;
    if (cred && cred.status === 'failed') {
      return { ok: false, error: 'Lumo master key failed: ' + (cred.message || 'unknown') };
    }
    if (cred && cred.status === 'ineligible') {
      warnings.push('User not eligible for Lumo cloud sync; exporting local Redux state only.');
    }

    let conversations = Object.values(state0.conversations || {}).filter((c) => c && !c.deleted && !c.ghost);
    if (conversations.length === 0) {
      // give hydrate more time
      await sleep(2000);
      conversations = Object.values(store.getState().conversations || {}).filter(
        (c) => c && !c.deleted && !c.ghost
      );
    }

    conversations.sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0)
    );

    for (const c of conversations) {
      try {
        await pullConversation(store, c.id);
      } catch (e) {
        warnings.push('pull failed for ' + c.id + ': ' + String(e && e.message ? e.message : e));
      }
    }

    const messagesAll = Object.values(store.getState().messages || {});
    const items = [];
    const details = [];
    for (const c of conversations) {
      const msgs = messagesAll
        .filter((m) => m && m.conversationId === c.id && !m.deleted)
        .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
      if (msgs.length === 0) {
        warnings.push('no messages for conversation ' + c.id + ' (' + (c.title || '') + ')');
      }
      const detail = buildDetail(c, msgs);
      items.push({
        id: detail.id,
        title: detail.title,
        create_time: detail.create_time,
        update_time: detail.update_time,
        space_id: detail.space_id,
        starred: detail.starred,
      });
      details.push(detail);
    }

    return {
      ok: true,
      conversations: items,
      details,
      warnings,
      conversationCount: items.length,
      messageCount: messagesAll.length,
    };
  })();
})()`;

async function ensureLumoTab(port: number): Promise<{ targetId: string; wsUrl: string }> {
  const targets = await listCdpTargets(port);
  const pages = targets.filter((t) => t.type === 'page' || t.type === 'tab');
  let target = pages.find((t) => isLumoUrl(t.url));
  if (!target) {
    target = await openCdpTab(port, LUMO_HOME);
  } else {
    await activateCdpTarget(port, target.id);
  }
  let wsUrl = target.webSocketDebuggerUrl;
  if (!wsUrl) {
    const refreshed = (await listCdpTargets(port)).find((t) => t.id === target!.id);
    wsUrl = refreshed?.webSocketDebuggerUrl;
  }
  if (!wsUrl) {
    throw new Error('No DevTools WebSocket for Lumo tab');
  }
  return { targetId: target.id, wsUrl };
}

export type LumoExportOptions = {
  cdpPort?: number;
  verbose?: boolean;
};

export async function exportLumoViaCdp(
  options: LumoExportOptions = {}
): Promise<LumoExportBundle> {
  let port = options.cdpPort ?? DEFAULT_CDP_PORT;
  if (!(await isCdpRunning(port))) {
    const found = await discoverCdpPort(port);
    if (found === null) {
      throw new Error(
        'No Chromium CDP endpoint found. Start with: prompt-exporter chromium start --url https://lumo.proton.me/'
      );
    }
    port = found;
  }

  const { wsUrl } = await ensureLumoTab(port);

  const result = await withCdpSocket(wsUrl, async (send) => {
    await send('Runtime.enable');
    await send('Page.enable').catch(() => undefined);
    const evaluated = await send('Runtime.evaluate', {
      expression: EXPORT_EXPRESSION,
      awaitPromise: true,
      returnByValue: true,
    });
    const remote = evaluated.result as JsonObject | undefined;
    if (remote?.exceptionDetails) {
      throw new Error(
        `Lumo export evaluate failed: ${JSON.stringify(remote.exceptionDetails).slice(0, 400)}`
      );
    }
    return (remote?.result as JsonObject | undefined)?.value as JsonObject | undefined;
  });

  if (!result || typeof result !== 'object') {
    throw new Error('Lumo export returned empty result');
  }
  if (result.ok === false) {
    throw new Error(String(result.error || 'Lumo export failed'));
  }

  const conversations = (result.conversations as LumoConversationItem[]) ?? [];
  const details = (result.details as LumoConversationDetail[]) ?? [];
  const warnings = (result.warnings as string[]) ?? [];

  if (options.verbose) {
    for (const w of warnings) {
      console.error(`[lumo] ${w}`);
    }
  }

  return { conversations, details, warnings };
}
