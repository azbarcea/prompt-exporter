import type {
  CopilotChatOverview,
  CopilotConversationDetail,
  CopilotConversationItem,
  CopilotConversationRaw,
  CopilotMessage,
} from './types.js';

/** Internal / UI-only message types to skip (from M365 Copilot Chat SPA). */
export const SKIP_MESSAGE_TYPES = new Set([
  'CrossPluginGroundingData',
  'Internal',
  'InternalSuggestions',
  'InternalLoaderMessage',
  'InternalSearchResult',
  'InternalSearchQuery',
  'Suggestion',
  'RenderCardRequest',
  'GenerateContentQuery',
  'AdsQuery',
]);

/** Substrate createTimeUtc / updateTimeUtc are unix milliseconds. */
export function millisToSeconds(ms: number | undefined | null): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 0;
  return ms > 1e12 ? Math.floor(ms / 1000) : Math.floor(ms);
}

export function isoToSeconds(iso: string | undefined | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

export function messageText(message: CopilotMessage): string {
  const direct = (message.text ?? '').trim();
  if (direct) return direct;
  const parts: string[] = [];
  for (const card of message.adaptiveCards ?? []) {
    for (const block of card.body ?? []) {
      if (typeof block.text === 'string' && block.text.trim()) {
        parts.push(block.text.trim());
      }
    }
  }
  return parts.join('\n\n');
}

export function isVisibleMessage(message: CopilotMessage): boolean {
  if (message.messageType && SKIP_MESSAGE_TYPES.has(message.messageType)) {
    return false;
  }
  if ((message.author ?? '').toLowerCase() === 'system') return false;
  return Boolean(messageText(message));
}

export function roleFromAuthor(author: string | undefined): 'user' | 'assistant' {
  return (author ?? '').toLowerCase() === 'user' ? 'user' : 'assistant';
}

export function attributionsMarkdown(message: CopilotMessage): string {
  const lines: string[] = [];
  for (const a of message.sourceAttributions ?? []) {
    const name = (a.providerDisplayName || a.seeMoreUrl || '').trim();
    const url = (a.seeMoreUrl || '').trim();
    if (url) lines.push(`- [${name || url}](${url})`);
    else if (name) lines.push(`- ${name}`);
  }
  return lines.length ? `\n\n**Sources**\n\n${lines.join('\n')}` : '';
}

export function overviewToItem(
  chat: CopilotChatOverview
): CopilotConversationItem {
  const create_time = millisToSeconds(chat.createTimeUtc);
  const update_time = millisToSeconds(chat.updateTimeUtc) || create_time;
  return {
    id: chat.conversationId,
    title: (chat.chatName || 'Untitled').trim() || 'Untitled',
    create_time,
    update_time,
  };
}

/**
 * Build a linear ChatGPT-style mapping from a Substrate GetConversation payload.
 */
export function conversationToDetail(
  raw: CopilotConversationRaw,
  listMeta?: CopilotConversationItem
): CopilotConversationDetail {
  const id = raw.conversationId || listMeta?.id || '';
  const title =
    (raw.chatName || listMeta?.title || 'Untitled').trim() || 'Untitled';
  const create_time =
    millisToSeconds(raw.createTimeUtc) || listMeta?.create_time || 0;
  const update_time =
    millisToSeconds(raw.updateTimeUtc) ||
    listMeta?.update_time ||
    create_time;

  const mapping: CopilotConversationDetail['mapping'] = {};
  const rootId = 'client-created-root';
  mapping[rootId] = {
    id: rootId,
    parent: null,
    children: [],
    message: null,
  };

  let parentId = rootId;
  let current: string | null = rootId;
  const visible = (raw.messages ?? []).filter(isVisibleMessage);

  for (const msg of visible) {
    const nodeId =
      msg.messageId ||
      `${id}:${msg.author ?? 'bot'}:${mapping[parentId]!.children.length}`;
    const role = roleFromAuthor(msg.author);
    const created =
      isoToSeconds(msg.createdAt ?? msg.timestamp) || create_time;
    const text = messageText(msg) + attributionsMarkdown(msg);

    mapping[nodeId] = {
      id: nodeId,
      parent: parentId,
      children: [],
      message: {
        id: nodeId,
        author: { role },
        content: { content_type: 'text', parts: [text] },
        create_time: created,
      },
    };
    mapping[parentId]!.children.push(nodeId);
    parentId = nodeId;
    current = nodeId;
  }

  return {
    id,
    title,
    create_time,
    update_time,
    mapping,
    current_node: current,
    _copilot: {
      tone: raw.tone,
      isLegacyWebChat: raw.isLegacyWebChat,
      messages: visible,
    },
  };
}
