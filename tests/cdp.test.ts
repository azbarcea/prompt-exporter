import assert from 'node:assert/strict';
import http from 'node:http';
import { after, describe, it } from 'node:test';
import {
  getCdpEndpointInfo,
  isCdpRunning,
  isChatGptUrl,
  listCdpTargets,
  openCdpTab,
} from '../src/utils/cdp.js';

describe('isChatGptUrl', () => {
  it('accepts chatgpt and chat.openai hosts', () => {
    assert.equal(isChatGptUrl('https://chatgpt.com/'), true);
    assert.equal(isChatGptUrl('https://chatgpt.com/api/auth/session'), true);
    assert.equal(isChatGptUrl('https://chat.openai.com/c/abc'), true);
    assert.equal(isChatGptUrl('https://example.com/'), false);
  });
});

describe('CDP probe', () => {
  let server: http.Server;
  let port = 0;

  it('detects version, lists targets, and opens tabs', async () => {
    const targets = [
      {
        id: 't1',
        type: 'page',
        title: 'ChatGPT',
        url: 'https://chatgpt.com/',
        webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/t1',
      },
    ];

    server = http.createServer((req, res) => {
      const url = req.url ?? '';
      if (url === '/json/version') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            Browser: 'HeadlessChrome/test',
            'Protocol-Version': '1.3',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/test`,
          })
        );
        return;
      }
      if (url === '/json/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(targets));
        return;
      }
      if (url.startsWith('/json/new?')) {
        const created = {
          id: 't2',
          type: 'page',
          title: 'session',
          url: 'https://chatgpt.com/api/auth/session',
          webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/t2',
        };
        targets.push(created);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(created));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    port = addr.port;

    assert.equal(await isCdpRunning(port), true);
    const info = await getCdpEndpointInfo(port);
    assert.ok(info);
    assert.equal(info.Browser, 'HeadlessChrome/test');

    const listed = await listCdpTargets(port);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.url, 'https://chatgpt.com/');

    const opened = await openCdpTab(port, 'https://chatgpt.com/api/auth/session');
    assert.equal(opened.id, 't2');
  });

  it('returns false when nothing is listening', async () => {
    assert.equal(await isCdpRunning(1), false);
    assert.equal(await getCdpEndpointInfo(1), null);
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
