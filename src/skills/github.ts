import type {
  SkillFile,
  SkillIndexEntry,
  SkillHost,
  SkillRegistry,
} from './types.js';
import { ensureRegistryClone } from './clone.js';
import {
  fetchSkillBundleFromClone,
  listSkillsFromClone,
} from './local.js';

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

type DirEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  downloadUrl?: string | null;
};

function hostOf(registry: SkillRegistry): SkillHost {
  return registry.host ?? 'github';
}

export function hostOfRegistry(registry: SkillRegistry): SkillHost {
  return hostOf(registry);
}

export function apiHeadersForHost(host: SkillHost): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'prompt-exporter',
    Accept: 'application/json',
  };
  if (host === 'github') {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
    const token =
      process.env.PROMPT_EXPORTER_GITHUB_TOKEN?.trim() ||
      process.env.GITHUB_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
  } else if (host === 'gitlab') {
    const token =
      process.env.PROMPT_EXPORTER_GITLAB_TOKEN?.trim() ||
      process.env.GITLAB_TOKEN?.trim();
    if (token) headers['PRIVATE-TOKEN'] = token;
  }
  return headers;
}

function apiHeaders(host: SkillHost): Record<string, string> {
  return apiHeadersForHost(host);
}

function isRateLimit(status: number, body: string): boolean {
  if (status === 403 || status === 429) {
    return /rate limit/i.test(body) || status === 429;
  }
  return false;
}

async function apiJson(
  url: string,
  host: SkillHost,
  fetchImpl: FetchLike
): Promise<unknown> {
  const res = await fetchImpl(url, { headers: apiHeaders(host) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (isRateLimit(res.status, body)) {
      const tokenHint =
        host === 'github'
          ? 'Set PROMPT_EXPORTER_GITHUB_TOKEN or GITHUB_TOKEN for a higher rate limit.'
          : host === 'gitlab'
            ? 'Set PROMPT_EXPORTER_GITLAB_TOKEN or GITLAB_TOKEN.'
            : 'Retry later or authenticate with the forge API.';
      throw new Error(
        `${host} API rate limit exceeded while calling ${url}. ${tokenHint}`
      );
    }
    throw new Error(
      `${host} API ${res.status} ${res.statusText} for ${url}` +
        (body ? `: ${body.slice(0, 200)}` : '')
    );
  }
  return res.json();
}

async function listDir(
  registry: SkillRegistry,
  dirPath: string,
  fetchImpl: FetchLike
): Promise<DirEntry[]> {
  const host = hostOf(registry);
  const clean = dirPath.replace(/^\/+|\/+$/g, '');

  if (host === 'github' || host === 'codeberg') {
    const apiBase =
      host === 'github'
        ? `https://api.github.com/repos/${registry.github}`
        : `https://codeberg.org/api/v1/repos/${registry.github}`;
    const url = `${apiBase}/contents/${clean}?ref=${encodeURIComponent(registry.ref)}`;
    const data = await apiJson(url, host, fetchImpl);
    if (!Array.isArray(data)) {
      throw new Error(`Expected directory listing for ${registry.github}/${clean}`);
    }
    return (data as Array<Record<string, unknown>>).map((item) => ({
      name: String(item.name ?? ''),
      path: String(item.path ?? ''),
      type: item.type === 'dir' ? 'dir' : 'file',
      downloadUrl:
        typeof item.download_url === 'string' ? item.download_url : null,
    }));
  }

  // GitLab
  const project = encodeURIComponent(registry.github);
  const url =
    `https://gitlab.com/api/v4/projects/${project}/repository/tree` +
    `?path=${encodeURIComponent(clean)}&ref=${encodeURIComponent(registry.ref)}&per_page=100`;
  const data = await apiJson(url, host, fetchImpl);
  if (!Array.isArray(data)) {
    throw new Error(`Expected directory listing for ${registry.github}/${clean}`);
  }
  return (data as Array<Record<string, unknown>>).map((item) => ({
    name: String(item.name ?? ''),
    path: String(item.path ?? ''),
    type: item.type === 'tree' ? 'dir' : 'file',
    downloadUrl: null,
  }));
}

function rawFileUrl(registry: SkillRegistry, filePath: string): string {
  const host = hostOf(registry);
  const clean = filePath.replace(/^\/+/, '');
  if (host === 'github') {
    return `https://raw.githubusercontent.com/${registry.github}/${registry.ref}/${clean}`;
  }
  if (host === 'codeberg') {
    return `https://codeberg.org/${registry.github}/raw/branch/${registry.ref}/${clean}`;
  }
  return `https://gitlab.com/${registry.github}/-/raw/${registry.ref}/${clean}`;
}

async function dirHasSkillMd(
  registry: SkillRegistry,
  dirPath: string,
  fetchImpl: FetchLike
): Promise<boolean> {
  const entries = await listDir(registry, dirPath, fetchImpl);
  return entries.some((e) => e.type === 'file' && e.name === 'SKILL.md');
}

function assignUniqueIds(entries: SkillIndexEntry[]): SkillIndexEntry[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
  }
  return entries.map((e) => {
    if ((counts.get(e.id) ?? 0) <= 1) return e;
    const parent = e.path.split('/').slice(-2, -1)[0];
    return parent ? { ...e, id: `${parent}/${e.id}` } : e;
  });
}

/**
 * List skill folders under the registry skillsPath.
 * Default: shallow-clone the repo over HTTPS and scan the local tree
 * (avoids forge Contents API rate limits; works offline after sync).
 * Pass `fetchImpl` to use the legacy Contents API (tests / offline API mocks).
 */
export async function listRemoteSkills(
  registry: SkillRegistry,
  options: {
    fetchImpl?: FetchLike;
    withDescriptions?: boolean;
    refresh?: boolean;
    /** Use an existing checkout instead of cloning (tests). */
    localRoot?: string;
  } = {}
): Promise<SkillIndexEntry[]> {
  if (!options.fetchImpl) {
    const root =
      options.localRoot ??
      (await ensureRegistryClone(registry, { refresh: options.refresh })).root;
    return listSkillsFromClone(root, registry, {
      withDescriptions: options.withDescriptions,
    });
  }

  const fetchImpl = options.fetchImpl;
  const top = await listDir(registry, registry.skillsPath, fetchImpl);
  const dirs = top.filter((i) => i.type === 'dir' && !i.name.startsWith('.'));
  const found: SkillIndexEntry[] = [];

  for (const dir of dirs) {
    const isSkill = await dirHasSkillMd(registry, dir.path, fetchImpl);
    if (isSkill) {
      found.push({ id: dir.name, path: dir.path });
      continue;
    }
    if (!registry.nested) continue;
    const children = await listDir(registry, dir.path, fetchImpl);
    for (const child of children) {
      if (child.type !== 'dir' || child.name.startsWith('.')) continue;
      if (await dirHasSkillMd(registry, child.path, fetchImpl)) {
        found.push({ id: child.name, path: child.path });
      }
    }
  }

  const entries = assignUniqueIds(found);

  if (options.withDescriptions) {
    await Promise.all(
      entries.map(async (entry) => {
        try {
          entry.description = await fetchSkillDescription(
            registry,
            entry.path,
            fetchImpl
          );
        } catch {
          // optional
        }
      })
    );
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchSkillDescription(
  registry: SkillRegistry,
  skillPath: string,
  fetchImpl: FetchLike
): Promise<string | undefined> {
  const rawUrl = rawFileUrl(registry, `${skillPath}/SKILL.md`);
  const res = await fetchImpl(rawUrl, {
    headers: { 'User-Agent': 'prompt-exporter', Accept: 'text/plain' },
  });
  if (!res.ok) return undefined;
  const text = await res.text();
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const descLine = match[1]!
    .split(/\r?\n/)
    .find((l) => l.startsWith('description:'));
  if (!descLine) return undefined;
  return descLine
    .slice('description:'.length)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Download all files under a skill folder (SKILL.md + companions).
 * Default: read from the local HTTPS clone. Pass `fetchImpl` for API/raw download.
 */
export async function fetchSkillBundle(
  registry: SkillRegistry,
  skillPathOrId: string,
  options: {
    fetchImpl?: FetchLike;
    resolvedPath?: string;
    refresh?: boolean;
    localRoot?: string;
  } = {}
): Promise<SkillFile[]> {
  let root = options.resolvedPath;
  if (!root) {
    if (skillPathOrId.includes('/')) {
      root = skillPathOrId.startsWith(registry.skillsPath)
        ? skillPathOrId
        : `${registry.skillsPath}/${skillPathOrId}`;
    } else {
      root = `${registry.skillsPath}/${skillPathOrId}`;
    }
  }
  root = root.replace(/\/+/g, '/');

  if (!options.fetchImpl) {
    const cloneRoot =
      options.localRoot ??
      (await ensureRegistryClone(registry, { refresh: options.refresh })).root;
    return fetchSkillBundleFromClone(cloneRoot, root);
  }

  const fetchImpl = options.fetchImpl;
  const files: SkillFile[] = [];

  async function walk(dirPath: string): Promise<void> {
    const entries = await listDir(registry, dirPath, fetchImpl);
    for (const item of entries) {
      if (item.type === 'dir') {
        await walk(item.path);
        continue;
      }
      const content = await fetchFileContent(item, registry, fetchImpl);
      const relativePath = item.path.slice(root!.length).replace(/^\//, '');
      if (!relativePath) continue;
      files.push({ relativePath, content });
    }
  }

  await walk(root);

  if (!files.some((f) => f.relativePath === 'SKILL.md')) {
    throw new Error(
      `Skill path "${root}" in registry "${registry.id}" has no SKILL.md`
    );
  }

  return files;
}

async function fetchFileContent(
  item: DirEntry,
  registry: SkillRegistry,
  fetchImpl: FetchLike
): Promise<string> {
  const url = item.downloadUrl || rawFileUrl(registry, item.path);
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent': 'prompt-exporter',
      Accept: 'application/octet-stream',
      ...apiHeaders(hostOf(registry)),
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download ${item.path}: ${res.status} ${res.statusText}`
    );
  }
  return res.text();
}

/** Resolve a user skill id to a remote index entry (id or path suffix). */
export function resolveSkillEntry(
  remote: SkillIndexEntry[],
  skillId: string
): SkillIndexEntry | undefined {
  const exact = remote.find((s) => s.id === skillId);
  if (exact) return exact;
  return remote.find(
    (s) =>
      s.path === skillId ||
      s.path.endsWith(`/${skillId}`) ||
      s.path === skillId.replace(/^\/*/, '')
  );
}
