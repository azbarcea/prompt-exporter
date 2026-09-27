import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { listRemoteSkills, fetchSkillBundle } from '../src/skills/github.js';
import type { FetchLike } from '../src/skills/github.js';
import { installSkills } from '../src/skills/install.js';
import {
  addUserRegistry,
  listBuiltinRegistries,
  listRegistries,
  parseGithubSource,
  removeUserRegistry,
} from '../src/skills/registries.js';
import type { SkillRegistry } from '../src/skills/types.js';

const registry: SkillRegistry = {
  id: 'test-reg',
  label: 'Test',
  description: 'fixture',
  github: 'acme/skills-repo',
  skillsPath: 'resources',
  ref: 'main',
};

function mockFetch(routes: Record<string, unknown | string>): FetchLike {
  return async (input: string) => {
    const url = String(input);
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        async text() {
          return '';
        },
        async json() {
          return {};
        },
      };
    }
    const body = hit[1];
    if (typeof body === 'string') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return body;
        },
        async json() {
          return JSON.parse(body);
        },
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async text() {
        return JSON.stringify(body);
      },
      async json() {
        return body;
      },
    };
  };
}

describe('parseGithubSource', () => {
  it('parses owner/repo and tree URLs', () => {
    assert.deepEqual(parseGithubSource('spencerpauly/awesome-cursor-skills'), {
      host: 'github',
      github: 'spencerpauly/awesome-cursor-skills',
    });
    assert.deepEqual(
      parseGithubSource(
        'https://github.com/spencerpauly/awesome-cursor-skills/tree/main/resources'
      ),
      {
        host: 'github',
        github: 'spencerpauly/awesome-cursor-skills',
        ref: 'main',
        skillsPath: 'resources',
      }
    );
  });

  it('parses gitlab and codeberg URLs', () => {
    assert.deepEqual(
      parseGithubSource(
        'https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills'
      ),
      {
        host: 'gitlab',
        github: 'gitlab-org/ai/skills',
        ref: 'main',
        skillsPath: 'skills',
      }
    );
    assert.deepEqual(
      parseGithubSource('https://codeberg.org/sbstjn/skills'),
      {
        host: 'codeberg',
        github: 'sbstjn/skills',
      }
    );
  });
});

describe('listBuiltinRegistries', () => {
  it('includes recommended public catalogs across forges', () => {
    const builtins = listBuiltinRegistries();
    const byId = Object.fromEntries(builtins.map((r) => [r.id, r]));
    assert.equal(byId['awesome-cursor-skills']?.skillsPath, 'resources');
    assert.equal(byId['vercel-agent-skills']?.github, 'vercel-labs/agent-skills');
    assert.equal(byId['anthropic-skills']?.github, 'anthropics/skills');
    assert.equal(byId['mattpocock-skills']?.nested, true);
    assert.equal(byId['posthog-skills']?.nested, true);
    assert.equal(byId['sentry-skills']?.github, 'getsentry/skills');
    assert.equal(byId['obra-superpowers']?.github, 'obra/superpowers');
    assert.equal(byId['gitlab-ai-skills']?.host, 'gitlab');
    assert.equal(byId['sbstjn-skills']?.host, 'codeberg');
  });
});

describe('listRemoteSkills + installSkills', () => {
  it('lists dirs and installs SKILL.md trees', async () => {
    const skillMd = `---
name: writing-commit-messages
description: Write conventional commits
---
# Writing Commit Messages
`;
    const fetchImpl = mockFetch({
      '/repos/acme/skills-repo/contents/resources?': [
        {
          name: 'writing-commit-messages',
          path: 'resources/writing-commit-messages',
          type: 'dir',
        },
        {
          name: 'creating-pr',
          path: 'resources/creating-pr',
          type: 'dir',
        },
        { name: 'README.md', path: 'resources/README.md', type: 'file' },
      ],
      '/repos/acme/skills-repo/contents/resources/writing-commit-messages?': [
        {
          name: 'SKILL.md',
          path: 'resources/writing-commit-messages/SKILL.md',
          type: 'file',
          download_url:
            'https://raw.githubusercontent.com/acme/skills-repo/main/resources/writing-commit-messages/SKILL.md',
        },
      ],
      '/repos/acme/skills-repo/contents/resources/creating-pr?': [
        {
          name: 'SKILL.md',
          path: 'resources/creating-pr/SKILL.md',
          type: 'file',
        },
      ],
      'resources/writing-commit-messages/SKILL.md': skillMd,
    });

    const listed = await listRemoteSkills(registry, { fetchImpl });
    assert.deepEqual(
      listed.map((s) => s.id),
      ['creating-pr', 'writing-commit-messages']
    );

    const files = await fetchSkillBundle(registry, 'writing-commit-messages', {
      fetchImpl,
      resolvedPath: 'resources/writing-commit-messages',
    });
    assert.equal(files.length, 1);
    assert.equal(files[0]!.relativePath, 'SKILL.md');

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pe-skills-'));
    try {
      const { results } = await installSkills({
        registry,
        skillIds: ['writing-commit-messages'],
        destination: '.cursor',
        cwd: tmp,
        fetchImpl,
        remoteIndex: listed,
      });
      assert.equal(results[0]?.status, 'created');
      const written = await fs.readFile(
        path.join(tmp, '.cursor/skills/writing-commit-messages/SKILL.md'),
        'utf-8'
      );
      assert.match(written, /conventional commits/);

      const again = await installSkills({
        registry,
        skillIds: ['writing-commit-messages'],
        destination: '.cursor',
        cwd: tmp,
        fetchImpl,
        remoteIndex: listed,
      });
      assert.equal(again.results[0]?.status, 'skipped');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('discovers nested category/skill layouts', async () => {
    const nestedReg: SkillRegistry = {
      ...registry,
      id: 'nested',
      nested: true,
      skillsPath: 'skills',
    };
    const fetchImpl = mockFetch({
      '/repos/acme/skills-repo/contents/skills?': [
        { name: 'engineering', path: 'skills/engineering', type: 'dir' },
        { name: 'README.md', path: 'skills/README.md', type: 'file' },
      ],
      '/repos/acme/skills-repo/contents/skills/engineering?': [
        { name: 'tdd', path: 'skills/engineering/tdd', type: 'dir' },
        { name: 'notes.md', path: 'skills/engineering/notes.md', type: 'file' },
      ],
      '/repos/acme/skills-repo/contents/skills/engineering/tdd?': [
        {
          name: 'SKILL.md',
          path: 'skills/engineering/tdd/SKILL.md',
          type: 'file',
        },
      ],
    });
    const listed = await listRemoteSkills(nestedReg, { fetchImpl });
    assert.deepEqual(listed, [
      { id: 'tdd', path: 'skills/engineering/tdd' },
    ]);
  });
});

describe('user registries', () => {
  const prevHome = process.env.PROMPT_EXPORTER_HOME;
  let tmpHome: string;

  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'pe-reg-'));
    process.env.PROMPT_EXPORTER_HOME = tmpHome;
  });

  after(async () => {
    if (prevHome === undefined) delete process.env.PROMPT_EXPORTER_HOME;
    else process.env.PROMPT_EXPORTER_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('adds and removes user registries without touching builtins', async () => {
    await addUserRegistry({
      id: 'team',
      label: 'Team',
      description: 'internal',
      github: 'acme/team-skills',
      skillsPath: 'skills',
      ref: 'main',
    });
    const all = await listRegistries();
    assert.ok(all.some((r) => r.id === 'awesome-cursor-skills'));
    assert.ok(all.some((r) => r.id === 'team' && !r.builtin));

    await removeUserRegistry('team');
    const afterRemove = await listRegistries();
    assert.ok(!afterRemove.some((r) => r.id === 'team'));

    await assert.rejects(
      () => removeUserRegistry('awesome-cursor-skills'),
      /built-in/
    );
  });
});
