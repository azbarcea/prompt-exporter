import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfigDir } from '../utils/paths.js';
import type { SkillAgent, SkillHost, SkillRegistry } from './types.js';

export const DEFAULT_SKILL_REGISTRY_ID = 'awesome-cursor-skills';

/**
 * Recommended public skill catalogs (GitHub / GitLab / Codeberg).
 * Paths verified against each repo’s SKILL.md layout.
 */
const BUILTIN_REGISTRIES: SkillRegistry[] = [
  {
    id: 'awesome-cursor-skills',
    label: 'Awesome Cursor Skills',
    description:
      'Curated Cursor-native skills (spencerpauly/awesome-cursor-skills)',
    host: 'github',
    github: 'spencerpauly/awesome-cursor-skills',
    skillsPath: 'resources',
    ref: 'main',
    agents: ['cursor'],
    builtin: true,
  },
  {
    id: 'vercel-agent-skills',
    label: 'Vercel Agent Skills',
    description:
      'Official Vercel agent skills (react, deploy, design guidelines) — skills.sh',
    host: 'github',
    github: 'vercel-labs/agent-skills',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['any', 'cursor', 'claude-code', 'codex'],
    builtin: true,
  },
  {
    id: 'anthropic-skills',
    label: 'Anthropic Skills',
    description:
      'Official Anthropic example skills (Agent Skills reference implementations)',
    host: 'github',
    github: 'anthropics/skills',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['claude-code', 'any'],
    builtin: true,
  },
  {
    id: 'mattpocock-skills',
    label: 'Matt Pocock Skills',
    description:
      'Engineering/productivity skills (grill-me, tdd, implement, …) — nested layout',
    host: 'github',
    github: 'mattpocock/skills',
    skillsPath: 'skills',
    ref: 'main',
    nested: true,
    agents: ['claude-code', 'codex', 'cursor', 'any'],
    builtin: true,
  },
  {
    id: 'posthog-skills',
    label: 'PostHog Skills',
    description:
      'PostHog analytics, feature flags, and LLM analytics skills — nested layout',
    host: 'github',
    github: 'PostHog/skills',
    skillsPath: 'skills',
    ref: 'main',
    nested: true,
    agents: ['any', 'cursor', 'claude-code'],
    builtin: true,
  },
  {
    id: 'sentry-skills',
    label: 'Sentry Skills',
    description:
      'Sentry code review, security, and debugging agent skills',
    host: 'github',
    github: 'getsentry/skills',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['any', 'cursor', 'claude-code'],
    builtin: true,
  },
  {
    id: 'obra-superpowers',
    label: 'Obra Superpowers',
    description:
      'obra/superpowers — composable agent skill pack for coding workflows',
    host: 'github',
    github: 'obra/superpowers',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['claude-code', 'cursor', 'any'],
    builtin: true,
  },
  {
    id: 'gitlab-ai-skills',
    label: 'GitLab AI Skills',
    description:
      'Official GitLab.org AI skills (MR review, pipelines, glab, …)',
    host: 'gitlab',
    github: 'gitlab-org/ai/skills',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['gitlab-duo', 'claude-code', 'opencode'],
    builtin: true,
  },
  {
    id: 'sbstjn-skills',
    label: 'sbstjn Skills (Codeberg)',
    description:
      'Language/stack skills (TypeScript, Rust, React, …) on Codeberg',
    host: 'codeberg',
    github: 'sbstjn/skills',
    skillsPath: 'skills',
    ref: 'main',
    agents: ['cursor', 'any'],
    builtin: true,
  },
];

export type UserRegistriesFile = {
  registries: SkillRegistry[];
};

export function getSkillsRegistriesPath(): string {
  return path.join(getConfigDir(), 'skills', 'registries.json');
}

export function listBuiltinRegistries(): SkillRegistry[] {
  return BUILTIN_REGISTRIES.map((r) => ({ ...r }));
}

function normalizeRegistry(r: SkillRegistry, builtin: boolean): SkillRegistry {
  const host = (r.host || 'github') as SkillHost;
  const agents = Array.isArray(r.agents)
    ? ([...new Set(r.agents.filter(Boolean))] as SkillAgent[])
    : undefined;
  return {
    id: r.id.trim(),
    label: (r.label || r.id).trim(),
    description: (r.description || '').trim(),
    host,
    github: r.github.trim(),
    skillsPath: (r.skillsPath || 'skills').replace(/^\/+|\/+$/g, ''),
    ref: (r.ref || 'main').trim() || 'main',
    nested: r.nested === true,
    agents: agents?.length ? agents : undefined,
    builtin,
  };
}

export async function loadUserRegistries(): Promise<SkillRegistry[]> {
  const filePath = getSkillsRegistriesPath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as UserRegistriesFile;
    if (!parsed || !Array.isArray(parsed.registries)) return [];
    return parsed.registries
      .filter((r) => r && typeof r.id === 'string' && typeof r.github === 'string')
      .map((r) => normalizeRegistry(r, false));
  } catch {
    return [];
  }
}

export async function saveUserRegistries(
  registries: SkillRegistry[]
): Promise<void> {
  const filePath = getSkillsRegistriesPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload: UserRegistriesFile = {
    registries: registries.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      host: r.host ?? 'github',
      github: r.github,
      skillsPath: r.skillsPath,
      ref: r.ref,
      nested: r.nested === true ? true : undefined,
      agents: r.agents?.length ? r.agents : undefined,
    })),
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
}

/** Built-ins first; user registries override same id. */
export async function listRegistries(): Promise<SkillRegistry[]> {
  const builtins = listBuiltinRegistries();
  const users = await loadUserRegistries();
  const byId = new Map<string, SkillRegistry>();
  for (const r of builtins) byId.set(r.id, r);
  for (const r of users) byId.set(r.id, { ...r, builtin: false });
  return [...byId.values()];
}

export async function getRegistry(id: string): Promise<SkillRegistry> {
  const all = await listRegistries();
  const found = all.find((r) => r.id === id);
  if (!found) {
    const known = all.map((r) => r.id).join(', ');
    throw new Error(`Unknown skill registry "${id}". Available: ${known}`);
  }
  return found;
}

export function resolveRegistryId(raw?: string): string {
  return raw?.trim() || DEFAULT_SKILL_REGISTRY_ID;
}

export type ParsedRepoSource = {
  host: SkillHost;
  github: string;
  ref?: string;
  skillsPath?: string;
};

/**
 * Parse owner/repo or https://{github|gitlab|codeberg}.com/… URLs.
 */
export function parseGithubSource(input: string): ParsedRepoSource {
  return parseRepoSource(input);
}

export function parseRepoSource(input: string): ParsedRepoSource {
  const trimmed = input.trim().replace(/\.git$/, '');

  const gitlabTree = trimmed.match(
    /^https?:\/\/gitlab\.com\/(.+?)\/-\/tree\/([^/]+)(?:\/(.*))?$/i
  );
  if (gitlabTree) {
    return {
      host: 'gitlab',
      github: gitlabTree[1]!,
      ref: gitlabTree[2],
      skillsPath: gitlabTree[3]?.replace(/\/+$/, '') || undefined,
    };
  }
  const gitlabRepo = trimmed.match(/^https?:\/\/gitlab\.com\/(.+?)\/?$/i);
  if (gitlabRepo && !gitlabRepo[1]!.includes('/-/')) {
    return { host: 'gitlab', github: gitlabRepo[1]!.replace(/\/+$/, '') };
  }

  const codebergTree = trimmed.match(
    /^https?:\/\/codeberg\.org\/([^/]+)\/([^/]+)\/(?:src\/branch|tree)\/([^/]+)(?:\/(.*))?$/i
  );
  if (codebergTree) {
    return {
      host: 'codeberg',
      github: `${codebergTree[1]}/${codebergTree[2]}`,
      ref: codebergTree[3],
      skillsPath: codebergTree[4]?.replace(/\/+$/, '') || undefined,
    };
  }
  const codebergRepo = trimmed.match(
    /^https?:\/\/codeberg\.org\/([^/]+)\/([^/]+)\/?$/i
  );
  if (codebergRepo) {
    return {
      host: 'codeberg',
      github: `${codebergRepo[1]}/${codebergRepo[2]}`,
    };
  }

  const ghTree = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/i
  );
  if (ghTree) {
    return {
      host: 'github',
      github: `${ghTree[1]}/${ghTree[2]}`,
      ref: ghTree[3],
      skillsPath: ghTree[4]?.replace(/\/+$/, '') || undefined,
    };
  }
  const ghRepo = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i
  );
  if (ghRepo) {
    return { host: 'github', github: `${ghRepo[1]}/${ghRepo[2]}` };
  }

  if (/^[^/]+\/[^/]+(?:\/[^/]+)*$/.test(trimmed) && !trimmed.includes('://')) {
    // owner/repo or group/sub/project (GitLab) — host chosen by caller/default
    return { host: 'github', github: trimmed };
  }

  throw new Error(
    `Invalid repository source "${input}". Use owner/repo or a github.com / gitlab.com / codeberg.org URL.`
  );
}

export async function addUserRegistry(
  registry: Omit<SkillRegistry, 'builtin'>
): Promise<SkillRegistry> {
  const users = await loadUserRegistries();
  if (users.some((r) => r.id === registry.id)) {
    throw new Error(`Skill registry "${registry.id}" already exists`);
  }
  if (listBuiltinRegistries().some((r) => r.id === registry.id)) {
    throw new Error(
      `Skill registry id "${registry.id}" is reserved for a built-in registry`
    );
  }
  const next = normalizeRegistry({ ...registry, builtin: false }, false);
  users.push(next);
  await saveUserRegistries(users);
  return next;
}

export async function removeUserRegistry(id: string): Promise<void> {
  if (listBuiltinRegistries().some((r) => r.id === id)) {
    throw new Error(`Cannot remove built-in skill registry "${id}"`);
  }
  const users = await loadUserRegistries();
  const next = users.filter((r) => r.id !== id);
  if (next.length === users.length) {
    throw new Error(`Unknown user skill registry "${id}"`);
  }
  await saveUserRegistries(next);
}
