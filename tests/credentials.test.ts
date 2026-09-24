import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  clearSavedToken,
  getTokenPath,
  loadSavedToken,
  saveToken,
} from '../src/utils/credentials.js';

const prevHome = process.env.PROMPT_EXPORTER_HOME;

afterEach(async () => {
  if (prevHome === undefined) delete process.env.PROMPT_EXPORTER_HOME;
  else process.env.PROMPT_EXPORTER_HOME = prevHome;
});

describe('credentials', () => {
  it('saves and loads a JWT token under sources/chatgpt/', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pe-cred-'));
    process.env.PROMPT_EXPORTER_HOME = dir;
    const token = `eyJ${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`;
    const file = await saveToken(token, 'chatgpt');
    assert.equal(file, getTokenPath('chatgpt'));
    assert.ok(file.includes(path.join('sources', 'chatgpt', 'token')));
    assert.equal(await loadSavedToken('chatgpt'), token);
    const st = await fs.stat(file);
    assert.equal(st.mode & 0o777, 0o600);
    await clearSavedToken('chatgpt');
    assert.equal(await loadSavedToken('chatgpt'), null);
  });
});
