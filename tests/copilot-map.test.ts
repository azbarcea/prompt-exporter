import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attributionsMarkdown,
  conversationToDetail,
  isVisibleMessage,
  messageText,
  millisToSeconds,
  overviewToItem,
  roleFromAuthor,
} from '../src/sources/copilot/api/map.js';
import type {
  CopilotChatOverview,
  CopilotConversationRaw,
  CopilotMessage,
} from '../src/sources/copilot/api/types.js';
import { isCopilotUrl } from '../src/utils/cdp.js';

describe('isCopilotUrl', () => {
  it('accepts M365 Copilot chat hosts', () => {
    assert.equal(isCopilotUrl('https://m365.cloud.microsoft/chat'), true);
    assert.equal(isCopilotUrl('https://m365.cloud.microsoft/chat/abc'), true);
    assert.equal(isCopilotUrl('https://www.microsoft365.com/chat'), true);
    assert.equal(isCopilotUrl('https://copilot.microsoft.com/'), true);
    assert.equal(isCopilotUrl('https://chatgpt.com/'), false);
  });
});

describe('copilot map', () => {
  it('converts substrate millis timestamps', () => {
    assert.equal(millisToSeconds(1_700_000_000_000), 1_700_000_000);
    assert.equal(millisToSeconds(1_700_000_000), 1_700_000_000);
    assert.equal(millisToSeconds(null), 0);
  });

  it('extracts adaptive card text when text is empty', () => {
    const msg: CopilotMessage = {
      author: 'bot',
      adaptiveCards: [
        {
          body: [{ type: 'TextBlock', text: 'Hello from card' }],
        },
      ],
    };
    assert.equal(messageText(msg), 'Hello from card');
    assert.equal(isVisibleMessage(msg), true);
  });

  it('skips internal message types', () => {
    assert.equal(
      isVisibleMessage({
        author: 'bot',
        messageType: 'InternalSearchQuery',
        text: 'search',
      }),
      false
    );
    assert.equal(roleFromAuthor('user'), 'user');
    assert.equal(roleFromAuthor('bot'), 'assistant');
  });

  it('maps overview and builds linear mapping', () => {
    const overview: CopilotChatOverview = {
      conversationId: 'conv-1',
      chatName: 'Arch tips',
      createTimeUtc: 1_700_000_000_000,
      updateTimeUtc: 1_700_000_100_000,
    };
    const item = overviewToItem(overview);
    assert.equal(item.id, 'conv-1');
    assert.equal(item.create_time, 1_700_000_000);
    assert.equal(item.update_time, 1_700_000_100);

    const raw: CopilotConversationRaw = {
      conversationId: 'conv-1',
      chatName: 'Arch tips',
      createTimeUtc: 1_700_000_000_000,
      updateTimeUtc: 1_700_000_100_000,
      messages: [
        {
          messageId: 'm1',
          author: 'user',
          text: 'What is pacman?',
          createdAt: '2023-11-14T22:13:20.000Z',
        },
        {
          messageId: 'm2',
          author: 'bot',
          text: 'The Arch package manager.',
          createdAt: '2023-11-14T22:13:25.000Z',
          sourceAttributions: [
            {
              providerDisplayName: 'Arch Wiki',
              seeMoreUrl: 'https://wiki.archlinux.org/',
            },
          ],
        },
        {
          messageId: 'm3',
          author: 'bot',
          messageType: 'InternalSuggestions',
          text: 'hidden',
        },
      ],
    };

    const detail = conversationToDetail(raw, item);
    assert.equal(detail.id, 'conv-1');
    assert.equal(detail.title, 'Arch tips');
    assert.equal(detail.mapping['client-created-root']?.children.length, 1);
    assert.equal(detail.mapping['m1']?.message?.author.role, 'user');
    assert.equal(detail.mapping['m2']?.message?.author.role, 'assistant');
    assert.match(
      detail.mapping['m2']!.message!.content.parts[0]!,
      /Arch package manager/
    );
    assert.match(
      detail.mapping['m2']!.message!.content.parts[0]!,
      /wiki\.archlinux\.org/
    );
    assert.equal(detail.mapping['m3'], undefined);
    assert.equal(detail.current_node, 'm2');
    assert.equal(attributionsMarkdown(raw.messages![1]!).includes('Arch Wiki'), true);
  });
});
