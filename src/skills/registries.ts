import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfigDir } from '../utils/paths.js';
import type { SkillRegistry } from './types.js';

export const DEFAULT_SKILL_REGISTRY_ID = 'awesome-cursor-skills';

const BUILTIN_REGISTRIES: SkillRegistry[] = [
  {
    id: 'awesome-cursor-skills',
    label: 'Awesome Cursor Skills',
    description:
      'Curated Cursor skills (spencerpauly/awesome-cursor-skills → resources/)',
    github: 'spencerpauly/awesome-cursor-skills',
    skillsPath: 'resources',
    ref: 'main',
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

export async function loadUserRegistries(): Promise<SkillRegistry[]> {
  const filePath = getSkillsRegistriesPath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as UserRegistriesFile;
    if (!parsed || !Array.isArray(parsed.registries)) return [];
    return parsed.registries
      .filter((r) => r && typeof r.id === 'string' && typeof r.github === 'string')
      .map((r) => ({
        id: r.id.trim(),
        label: (r.label || r.id).trim(),
        description: (r.description || '').trim(),
        github: r.github.trim(),
        skillsPath: (r.skillsPath || 'skills').replace(/^\/+|\/+$/g, ''),
        ref: (r.ref || 'main').trim() || 'main',
        builtin: false,
      }));
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
      github: r.github,
      skillsPath: r.skillsPath,
      ref: r.ref,
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

/**
 * Parse owner/repo or https://github.com/owner/repo[/tree/ref/path...].
 * Returns github, optional ref and skillsPath from /tree/… when present.
 */
export function parseGithubSource(input: string): {
  github: string;
  ref?: string;
  skillsPath?: string;
} {
  const trimmed = input.trim().replace(/\.git$/, '');
  const treeMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/i
  );
  if (treeMatch) {
    return {
      github: `${treeMatch[1]}/${treeMatch[2]}`,
      ref: treeMatch[3],
      skillsPath: treeMatch[4]?.replace(/\/+$/, '') || undefined,
    };
  }
  const repoMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i
  );
  if (repoMatch) {
    return { github: `${repoMatch[1]}/${repoMatch[2]}` };
  }
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    return { github: trimmed };
  }
  throw new Error(
    `Invalid GitHub source "${input}". Use owner/repo or a github.com URL.`
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
  const next: SkillRegistry = { ...registry, builtin: false };
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
