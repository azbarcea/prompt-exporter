import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'index.cjs');

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('cli help (built dist)', () => {
  it('prints version', () => {
    const { status, stdout } = run(['--version']);
    assert.equal(status, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
  });

  it('keeps standard help without install instructions', () => {
    const { status, stdout } = run(['--help']);
    assert.equal(status, 0);
    assert.match(stdout, /Usage: prompt-exporter/);
    assert.match(stdout, /Commands:/);
    assert.doesNotMatch(stdout, /npm install/);
    assert.doesNotMatch(stdout, /yay -S/);
    assert.match(stdout, /Typical flow/);
    assert.match(stdout, /chromium start/);
    assert.match(stdout, /prompt-exporter sync/);
  });

  it('documents chromium start --port default 9222 and --force', () => {
    const { status, stdout } = run(['chromium', 'start', '--help']);
    assert.equal(status, 0);
    assert.match(stdout, /--port <PORT>/);
    assert.match(stdout, /9222/);
    assert.match(stdout, /--force/);
    assert.match(stdout, /--isolated/);
    assert.match(stdout, /system profile/i);
  });

  it('documents sync options and sources', () => {
    const { status, stdout } = run(['sync', '--help']);
    assert.equal(status, 0);
    assert.match(stdout, /--no-incremental/);
    assert.match(stdout, /--source/);

    const sources = run(['sources']);
    assert.equal(sources.status, 0);
    assert.match(sources.stdout, /chatgpt/);
    assert.match(sources.stdout, /lumo/);
    assert.match(sources.stdout, /perplexity/);
    assert.match(sources.stdout, /copilot/);
  });

  it('documents rule-install', () => {
    const { status, stdout } = run(['rule-install', '--help']);
    assert.equal(status, 0);
    assert.match(stdout, /--destination/);
    assert.match(stdout, /--force/);
    assert.match(stdout, /--list/);
    assert.match(stdout, /\.cursor/);

    const listed = run(['rule-install', '--list']);
    assert.equal(listed.status, 0);
    assert.match(listed.stdout, /plans-location/);
    assert.match(listed.stdout, /journal-logging/);
  });

  it('documents skill-install and skill-registry', () => {
    const install = run(['skill-install', '--help']);
    assert.equal(install.status, 0);
    assert.match(install.stdout, /--registry/);
    assert.match(install.stdout, /awesome-cursor-skills/);
    assert.match(install.stdout, /\.cursor\/skills/);

    const reg = run(['skill-registry', '--help']);
    assert.equal(reg.status, 0);
    assert.match(reg.stdout, /list/);
    assert.match(reg.stdout, /add/);
    assert.match(reg.stdout, /remove/);

    const listed = run(['skill-registry', 'list']);
    assert.equal(listed.status, 0);
    assert.match(listed.stdout, /awesome-cursor-skills/);
    assert.match(listed.stdout, /vercel-agent-skills/);
    assert.match(listed.stdout, /gitlab-ai-skills/);
    assert.match(listed.stdout, /sbstjn-skills/);
  });
});
