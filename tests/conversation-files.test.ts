import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFrontmatter,
  formatUpdateStamp,
  markdownFilename,
  relativeJsonFromMd,
  sanitizeTitleForFilename,
  toDate,
} from '../src/utils/conversation-files.js';
import { convertConversation } from '../src/services/markdown-service.js';

describe('conversation-files', () => {
  it('formats update stamp as YYYY-mm-dd-HHMM', () => {
    const d = new Date(2026, 8, 23, 18, 41, 0); // local Sep 23 2026 18:41
    assert.equal(formatUpdateStamp(d), '2026-09-23-1841');
  });

  it('keeps spaces in titles and strips path chars', () => {
    assert.equal(
      sanitizeTitleForFilename('Analyze Insurance/Renewal'),
      'Analyze Insurance-Renewal'
    );
    assert.equal(
      sanitizeTitleForFilename('  Hello   World  '),
      'Hello World'
    );
  });

  it('builds dated markdown filename', () => {
    const name = markdownFilename({
      title: 'Analyze Insurance Renewal',
      update_time: new Date('2026-09-23T18:41:14Z').getTime() / 1000,
      create_time: new Date('2026-09-23T17:23:31Z').getTime() / 1000,
    });
    assert.match(name, /^2026-09-23-\d{4}\.Analyze Insurance Renewal\.md$/);
  });

  it('parses unix seconds and ISO', () => {
    const a = toDate(1790198474);
    assert.ok(a);
    const b = toDate('2026-09-23T18:41:14.420905Z');
    assert.ok(b);
  });

  it('builds frontmatter with json link', () => {
    const fm = buildFrontmatter({
      id: 'abc-123',
      title: 'Hello: World',
      updated: '2026-09-23T18:41:14.000Z',
      created: '2026-09-23T17:00:00.000Z',
      json: relativeJsonFromMd('abc-123'),
    });
    assert.ok(fm.startsWith('---\n'));
    assert.ok(fm.includes('id: abc-123'));
    assert.ok(fm.includes('json: json/abc-123.json'));
    assert.ok(fm.includes('title: "Hello: World"'));
  });
});

describe('convertConversation frontmatter', () => {
  it('prefixes YAML frontmatter and title', () => {
    const md = convertConversation(
      {
        id: 'c1',
        title: 'Test Chat',
        create_time: 1700000000,
        update_time: 1700001000,
        mapping: {
          root: {
            id: 'root',
            parent: null,
            children: ['m1'],
            message: null,
          },
          m1: {
            id: 'm1',
            parent: 'root',
            children: [],
            message: {
              id: 'm1',
              author: { role: 'user' },
              content: { content_type: 'text', parts: ['hi'] },
              weight: 1,
            },
          },
        },
        current_node: 'm1',
      },
      undefined,
      { conversationId: 'c1' }
    );
    assert.ok(md.startsWith('---\n'));
    assert.ok(md.includes('id: c1'));
    assert.ok(md.includes('json: json/c1.json'));
    assert.ok(md.includes('# Test Chat'));
    assert.ok(md.includes('**User:**'));
  });
});
