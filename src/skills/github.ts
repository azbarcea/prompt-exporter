import type { SkillFile, SkillIndexEntry, SkillRegistry } from './types.js';

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

type GhContentItem = {
  name: string;
  path: string;
  type: 'file' | 'dir' | string;
  download_url?: string | null;
  size?: number;
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'prompt-exporter',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token =
    process.env.PROMPT_EXPORTER_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubJson(
  url: string,
  fetchImpl: FetchLike
): Promise<unknown> {
  const res = await fetchImpl(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GitHub API ${res.status} ${res.statusText} for ${url}` +
        (body ? `: ${body.slice(0, 200)}` : '')
    );
  }
  return res.json();
}

function contentsUrl(registry: SkillRegistry, dirPath: string): string {
  const clean = dirPath.replace(/^\/+|\/+$/g, '');
  const base = `https://api.github.com/repos/${registry.github}/contents/${clean}`;
  return `${base}?ref=${encodeURIComponent(registry.ref)}`;
}

/**
 * List skill folders (directories) under the registry skillsPath.
 */
export async function listRemoteSkills(
  registry: SkillRegistry,
  options: { fetchImpl?: FetchLike; withDescriptions?: boolean } = {}
): Promise<SkillIndexEntry[]> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const data = await githubJson(
    contentsUrl(registry, registry.skillsPath),
    fetchImpl
  );
  if (!Array.isArray(data)) {
    throw new Error(
      `Expected directory listing for ${registry.github}/${registry.skillsPath}`
    );
  }
  const dirs = (data as GhContentItem[]).filter((i) => i.type === 'dir');
  const entries: SkillIndexEntry[] = dirs.map((d) => ({
    id: d.name,
    path: d.path,
  }));

  if (options.withDescriptions) {
    await Promise.all(
      entries.map(async (entry) => {
        try {
          entry.description = await fetchSkillDescription(
            registry,
            entry.id,
            fetchImpl
          );
        } catch {
          // optional metadata
        }
      })
    );
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchSkillDescription(
  registry: SkillRegistry,
  skillId: string,
  fetchImpl: FetchLike
): Promise<string | undefined> {
  const skillMdPath = `${registry.skillsPath}/${skillId}/SKILL.md`;
  const rawUrl = `https://raw.githubusercontent.com/${registry.github}/${registry.ref}/${skillMdPath}`;
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
 */
export async function fetchSkillBundle(
  registry: SkillRegistry,
  skillId: string,
  options: { fetchImpl?: FetchLike } = {}
): Promise<SkillFile[]> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const root = `${registry.skillsPath}/${skillId}`.replace(/\/+/g, '/');
  const files: SkillFile[] = [];

  async function walk(dirPath: string): Promise<void> {
    const data = await githubJson(contentsUrl(registry, dirPath), fetchImpl);
    if (!Array.isArray(data)) {
      throw new Error(`Expected directory listing for ${dirPath}`);
    }
    for (const item of data as GhContentItem[]) {
      if (item.type === 'dir') {
        await walk(item.path);
        continue;
      }
      if (item.type !== 'file') continue;
      const content = await fetchFileContent(item, registry, fetchImpl);
      const relativePath = item.path.slice(root.length).replace(/^\//, '');
      if (!relativePath) continue;
      files.push({ relativePath, content });
    }
  }

  await walk(root);

  if (!files.some((f) => f.relativePath === 'SKILL.md')) {
    throw new Error(
      `Skill "${skillId}" in registry "${registry.id}" has no SKILL.md`
    );
  }

  return files;
}

async function fetchFileContent(
  item: GhContentItem,
  registry: SkillRegistry,
  fetchImpl: FetchLike
): Promise<string> {
  const url =
    item.download_url ||
    `https://raw.githubusercontent.com/${registry.github}/${registry.ref}/${item.path}`;
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent': 'prompt-exporter',
      Accept: 'application/octet-stream',
      ...githubHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download ${item.path}: ${res.status} ${res.statusText}`
    );
  }
  return res.text();
}
