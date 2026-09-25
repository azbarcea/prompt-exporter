import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractAnswer,
  listItemToConversation,
  parsePerplexityTime,
  threadToDetail,
} from '../src/sources/perplexity/api/map.js';
import type { ThreadEntry, ThreadListItem } from '../src/sources/perplexity/api/types.js';
import { isPerplexityUrl } from '../src/utils/cdp.js';

describe('isPerplexityUrl', () => {
  it('accepts perplexity hosts', () => {
    assert.equal(isPerplexityUrl('https://www.perplexity.ai/'), true);
    assert.equal(isPerplexityUrl('https://perplexity.ai/search/foo'), true);
    assert.equal(isPerplexityUrl('https://chatgpt.com/'), false);
  });
});

describe('perplexity map', () => {
  it('parses timestamps to epoch seconds', () => {
    assert.equal(
      parsePerplexityTime('2024-01-15T12:00:00Z'),
      Math.floor(Date.parse('2024-01-15T12:00:00Z') / 1000)
    );
    assert.equal(parsePerplexityTime(null), 0);
  });

  it('prefers ask_text_0_markdown answer', () => {
    const entry: ThreadEntry = {
      uuid: 'e1',
      blocks: [
        {
          intended_usage: 'ask_text',
          markdown_block: { answer: 'plain' },
        },
        {
          intended_usage: 'ask_text_0_markdown',
          markdown_block: { answer: 'md answer' },
        },
      ],
    };
    assert.equal(extractAnswer(entry), 'md answer');
  });

  it('maps list item and builds linear mapping', () => {
    const item: ThreadListItem = {
      uuid: 'thr-1',
      title: 'Hello',
      slug: 'hello-abc',
      last_query_datetime: '2024-06-01T00:00:00Z',
      collection: { uuid: 'space-1' },
    };
    const listMeta = listItemToConversation(item);
    assert.equal(listMeta.id, 'thr-1');
    assert.equal(listMeta.space_id, 'space-1');

    const detail = threadToDetail(
      listMeta,
      {
        thread_metadata: {
          title: 'Hello world',
          created_at: '2024-05-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
        },
      },
      [
        {
          uuid: 'entry-1',
          query_str: 'What is Arch?',
          entry_created_datetime: '2024-05-01T00:00:00Z',
          blocks: [
            {
              intended_usage: 'ask_text_0_markdown',
              markdown_block: { answer: 'A Linux distro.' },
            },
            {
              intended_usage: 'web_results',
              web_result_block: {
                web_results: [{ name: 'Arch Wiki', url: 'https://wiki.archlinux.org/' }],
              },
            },
          ],
        },
      ]
    );

    assert.equal(detail.title, 'Hello world');
    assert.ok(detail.mapping['client-created-root']);
    assert.equal(detail.mapping['entry-1:user']?.message?.author.role, 'user');
    assert.equal(
      detail.mapping['entry-1:assistant']?.message?.content.parts[0],
      'A Linux distro.\n\n**Sources**\n\n- [Arch Wiki](https://wiki.archlinux.org/)'
    );
    assert.equal(detail.current_node, 'entry-1:assistant');
  });
});
