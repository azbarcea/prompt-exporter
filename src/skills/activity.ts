import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfigDir } from '../utils/paths.js';
import type { FetchLike } from './github.js';
import { apiHeadersForHost, hostOfRegistry } from './github.js';
import type { RepoActivity, SkillHost, SkillRegistry } from './types.js';

type CacheFile = {
  updatedAt: string;
  entries: Record<
    string,
    { pushedAt: string; fetchedAt: string }
  >;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function cachePath(): string {
  return path.join(getConfigDir(), 'skills', 'repo-meta.json');
}

function cacheKey(registry: SkillRegistry): string {
  const host = hostOfRegistry(registry);
  return `${host}:${registry.github}`;
}

async function readCache(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(cachePath(), 'utf-8');
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed?.entries) return { updatedAt: new Date().toISOString(), entries: {} };
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: {} };
  }
}

async function writeCache(cache: CacheFile): Promise<void> {
  const file = cachePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  cache.updatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

async function fetchPushedAt(
  registry: SkillRegistry,
  fetchImpl: FetchLike
): Promise<string | null> {
  const host = hostOfRegistry(registry);
  try {
    if (host === 'github') {
      const url = `https://api.github.com/repos/${registry.github}`;
      const res = await fetchImpl(url, {
        headers: apiHeadersForHost(host),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { pushed_at?: string };
      return json.pushed_at ?? null;
    }
    if (host === 'codeberg') {
      const url = `https://codeberg.org/api/v1/repos/${registry.github}`;
      const res = await fetchImpl(url, {
        headers: apiHeadersForHost(host),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        updated_at?: string;
        empty?: boolean;
      };
      return json.updated_at ?? null;
    }
    // GitLab
    const project = encodeURIComponent(registry.github);
    const url = `https://gitlab.com/api/v4/projects/${project}`;
    const res = await fetchImpl(url, {
      headers: apiHeadersForHost(host),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { last_activity_at?: string };
    return json.last_activity_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Last repo activity (push / last_activity), with on-disk cache.
 * Returns null when unavailable (rate limit, network, private).
 */
export async function getRepoActivity(
  registry: SkillRegistry,
  options: { fetchImpl?: FetchLike; forceRefresh?: boolean } = {}
): Promise<RepoActivity | null> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const key = cacheKey(registry);
  const cache = await readCache();
  const hit = cache.entries[key];
  if (
    hit &&
    !options.forceRefresh &&
    Date.now() - Date.parse(hit.fetchedAt) < CACHE_TTL_MS
  ) {
    return { pushedAt: hit.pushedAt, source: 'cache' };
  }

  const pushedAt = await fetchPushedAt(registry, fetchImpl);
  if (!pushedAt) {
    if (hit) return { pushedAt: hit.pushedAt, source: 'cache' };
    return null;
  }

  cache.entries[key] = {
    pushedAt,
    fetchedAt: new Date().toISOString(),
  };
  await writeCache(cache).catch(() => undefined);
  return { pushedAt, source: 'api' };
}

export async function getRepoActivities(
  registries: SkillRegistry[],
  options: { fetchImpl?: FetchLike } = {}
): Promise<Map<string, RepoActivity | null>> {
  const out = new Map<string, RepoActivity | null>();
  await Promise.all(
    registries.map(async (r) => {
      out.set(r.id, await getRepoActivity(r, options));
    })
  );
  return out;
}

// Re-export helper typing for tests
export type { SkillHost };
