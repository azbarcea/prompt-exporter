import type {
  PerplexityConversationDetail,
  PerplexityConversationItem,
  ThreadDetailResponse,
  ThreadEntry,
  ThreadListItem,
} from './types.js';

export function parsePerplexityTime(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

export function extractAnswer(entry: ThreadEntry): string {
  const blocks = entry.blocks ?? [];
  for (const b of blocks) {
    if (
      b.intended_usage === 'ask_text_0_markdown' &&
      b.markdown_block?.answer
    ) {
      return b.markdown_block.answer;
    }
  }
  for (const b of blocks) {
    if (b.intended_usage === 'ask_text' && b.markdown_block?.answer) {
      return b.markdown_block.answer;
    }
  }
  for (const b of blocks) {
    if (b.markdown_block?.answer) return b.markdown_block.answer;
  }
  return '';
}

export function extractSourcesMarkdown(entry: ThreadEntry): string {
  const lines: string[] = [];
  for (const b of entry.blocks ?? []) {
    if (b.intended_usage !== 'web_results' || !b.web_result_block?.web_results) {
      continue;
    }
    for (const wr of b.web_result_block.web_results) {
      const name = (wr.name || wr.url || 'source').trim();
      const url = (wr.url || '').trim();
      if (url) lines.push(`- [${name}](${url})`);
      else if (name) lines.push(`- ${name}`);
    }
  }
  return lines.length ? `\n\n**Sources**\n\n${lines.join('\n')}` : '';
}

export function listItemToConversation(
  item: ThreadListItem
): PerplexityConversationItem {
  const update = parsePerplexityTime(item.last_query_datetime);
  return {
    id: item.uuid,
    title: (item.title || item.query_str || 'Untitled').trim() || 'Untitled',
    create_time: update,
    update_time: update,
    slug: item.slug ?? undefined,
    space_id: item.collection?.uuid,
  };
}

/**
 * Build a linear ChatGPT-style mapping: root → user → assistant → …
 */
export function threadToDetail(
  listMeta: PerplexityConversationItem,
  page: ThreadDetailResponse,
  allEntries: ThreadEntry[]
): PerplexityConversationDetail {
  const meta = page.thread_metadata ?? {};
  const title =
    (meta.title || listMeta.title || 'Untitled').trim() || 'Untitled';
  const create_time =
    parsePerplexityTime(meta.created_at) || listMeta.create_time;
  const update_time =
    parsePerplexityTime(meta.updated_at) ||
    listMeta.update_time ||
    create_time;

  const mapping: PerplexityConversationDetail['mapping'] = {};
  const rootId = 'client-created-root';
  mapping[rootId] = {
    id: rootId,
    parent: null,
    children: [],
    message: null,
  };

  let parentId = rootId;
  let current: string | null = rootId;

  for (const entry of allEntries) {
    const created =
      parsePerplexityTime(entry.entry_created_datetime) || create_time;
    const userId = `${entry.uuid}:user`;
    const asstId = `${entry.uuid}:assistant`;
    const query = (entry.query_str || '').trim();
    const answer = extractAnswer(entry) + extractSourcesMarkdown(entry);

    mapping[userId] = {
      id: userId,
      parent: parentId,
      children: [asstId],
      message: {
        id: userId,
        author: { role: 'user' },
        content: { content_type: 'text', parts: [query] },
        create_time: created,
      },
    };
    mapping[parentId]!.children.push(userId);

    mapping[asstId] = {
      id: asstId,
      parent: userId,
      children: [],
      message: {
        id: asstId,
        author: { role: 'assistant' },
        content: { content_type: 'text', parts: [answer] },
        create_time: created,
      },
    };

    parentId = asstId;
    current = asstId;
  }

  return {
    id: listMeta.id,
    title,
    create_time,
    update_time,
    slug: listMeta.slug,
    space_id: listMeta.space_id,
    mapping,
    current_node: current,
    _perplexity: {
      slug: listMeta.slug,
      entries: allEntries,
    },
  };
}
