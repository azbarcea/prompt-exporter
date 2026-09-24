import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  getConfigDir,
  getDataParentDir,
  getDefaultDataDir,
  getIsolatedChromiumProfileDir,
  getSourceDataDir,
  resolveChromiumUserDataDir,
} from '../src/utils/paths.js';

const ENV_KEYS = [
  'PROMPT_EXPORTER_HOME',
  'PROMPT_EXPORTER_DATA',
  'PROMPT_EXPORTER_USER_DATA_DIR',
  'CHATGPT_EXPORTER_HOME',
  'CHATGPT_EXPORTER_DATA',
  'CHATGPT_EXPORTER_USER_DATA_DIR',
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

for (const key of ENV_KEYS) {
  saved[key] = process.env[key];
  delete process.env[key];
}

describe('paths', () => {
  it('defaults config dir to ~/.prompt-exporter', () => {
    assert.equal(getConfigDir(), path.join(os.homedir(), '.prompt-exporter'));
  });

  it('defaults chatgpt source dir under home', () => {
    assert.equal(
      getDefaultDataDir(),
      path.join(os.homedir(), '.prompt-exporter', 'chatgpt')
    );
    assert.equal(getSourceDataDir('chatgpt'), getDefaultDataDir());
  });

  it('defaults isolated chromium under home', () => {
    assert.equal(
      getIsolatedChromiumProfileDir(),
      path.join(os.homedir(), '.prompt-exporter', 'chromium')
    );
  });

  it('respects PROMPT_EXPORTER_HOME', () => {
    process.env.PROMPT_EXPORTER_HOME = '/tmp/pe-home';
    assert.equal(getConfigDir(), '/tmp/pe-home');
    assert.equal(getSourceDataDir('chatgpt'), '/tmp/pe-home/chatgpt');
  });

  it('respects PROMPT_EXPORTER_DATA as parent of sources', () => {
    process.env.PROMPT_EXPORTER_HOME = '/tmp/pe-home';
    process.env.PROMPT_EXPORTER_DATA = '/tmp/custom-parent';
    assert.equal(getDataParentDir(), '/tmp/custom-parent');
    assert.equal(getSourceDataDir('chatgpt'), '/tmp/custom-parent/chatgpt');
  });

  it('respects custom user data dir', () => {
    process.env.PROMPT_EXPORTER_USER_DATA_DIR = '/tmp/my-chrome';
    assert.deepEqual(resolveChromiumUserDataDir({}), {
      dir: '/tmp/my-chrome',
      mode: 'custom',
    });
  });
});
