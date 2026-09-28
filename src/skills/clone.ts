import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getConfigDir } from '../utils/paths.js';
import type { SkillHost, SkillRegistry } from './types.js';

const execFileAsync = promisify(execFile);

function hostOf(registry: SkillRegistry): SkillHost {
  return registry.host ?? 'github';
}

/** How long a local clone is considered fresh before a silent `git fetch`. */
export const CLONE_REFRESH_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export type GitRunner = (
  args: string[],
  options?: { cwd?: string }
) => Promise<{ stdout: string; stderr: string }>;

export async function defaultGitRunner(
  args: string[],
  options: { cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: options.cwd,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: 'echo',
      },
    });
    return {
      stdout: typeof stdout === 'string' ? stdout : String(stdout),
      stderr: typeof stderr === 'string' ? stderr : String(stderr),
    };
  } catch (error) {
    const err = error as {
      code?: string;
      message?: string;
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    if (err.code === 'ENOENT') {
      throw new Error(
        'git is required to sync skill registries. Install git and retry.'
      );
    }
    const detail =
      (typeof err.stderr === 'string'
        ? err.stderr
        : err.stderr
          ? String(err.stderr)
          : '') ||
      err.message ||
      'git command failed';
    throw new Error(`git ${args.join(' ')} failed: ${detail.trim()}`);
  }
}

export function cloneCacheRoot(): string {
  return path.join(getConfigDir(), 'skills', 'repos');
}

/** Filesystem path for a registry's shallow clone. */
export function registryClonePath(registry: SkillRegistry): string {
  const host = hostOf(registry);
  return path.join(cloneCacheRoot(), host, ...registry.github.split('/'));
}

export function cloneRemoteUrl(registry: SkillRegistry): string {
  const host = hostOf(registry);
  const repo = registry.github.replace(/\.git$/, '');
  if (host === 'github') return `https://github.com/${repo}.git`;
  if (host === 'codeberg') return `https://codeberg.org/${repo}.git`;
  return `https://gitlab.com/${repo}.git`;
}

type FetchStampFile = {
  updatedAt: string;
  entries: Record<string, { fetchedAt: string; ref: string }>;
};

function stampPath(): string {
  return path.join(cloneCacheRoot(), 'fetch-stamp.json');
}

function stampKey(registry: SkillRegistry): string {
  return `${hostOf(registry)}:${registry.github}@${registry.ref}`;
}

async function readStamp(): Promise<FetchStampFile> {
  try {
    const raw = await fs.readFile(stampPath(), 'utf-8');
    const parsed = JSON.parse(raw) as FetchStampFile;
    if (!parsed?.entries) {
      return { updatedAt: new Date().toISOString(), entries: {} };
    }
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: {} };
  }
}

async function writeStamp(stamp: FetchStampFile): Promise<void> {
  await fs.mkdir(cloneCacheRoot(), { recursive: true });
  stamp.updatedAt = new Date().toISOString();
  await fs.writeFile(stampPath(), JSON.stringify(stamp, null, 2) + '\n', 'utf-8');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepo(dir: string, git: GitRunner): Promise<boolean> {
  if (!(await pathExists(path.join(dir, '.git')))) return false;
  try {
    await git(['rev-parse', '--git-dir'], { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a shallow HTTPS clone of the registry repo exists and is reasonably fresh.
 * Prefer this over forge Contents APIs (avoids rate limits; works offline after sync).
 */
export async function ensureRegistryClone(
  registry: SkillRegistry,
  options: {
    refresh?: boolean;
    git?: GitRunner;
    ttlMs?: number;
  } = {}
): Promise<{ root: string; updated: boolean }> {
  const git = options.git ?? defaultGitRunner;
  const ttl = options.ttlMs ?? CLONE_REFRESH_TTL_MS;
  const root = registryClonePath(registry);
  const url = cloneRemoteUrl(registry);
  const ref = registry.ref || 'main';
  const stamp = await readStamp();
  const key = stampKey(registry);
  const last = stamp.entries[key];
  const fresh =
    last &&
    last.ref === ref &&
    Date.now() - Date.parse(last.fetchedAt) < ttl;

  const hasRepo = await isGitRepo(root, git);

  if (hasRepo && fresh && !options.refresh) {
    return { root, updated: false };
  }

  await fs.mkdir(path.dirname(root), { recursive: true });

  if (!hasRepo) {
    if (await pathExists(root)) {
      await fs.rm(root, { recursive: true, force: true });
    }
    await git([
      'clone',
      '--depth',
      '1',
      '--branch',
      ref,
      '--single-branch',
      url,
      root,
    ]);
  } else {
    await git(['remote', 'set-url', 'origin', url], { cwd: root });
    await git(['fetch', '--depth', '1', 'origin', ref], { cwd: root });
    await git(['checkout', '-B', ref, 'FETCH_HEAD'], { cwd: root });
  }

  stamp.entries[key] = {
    fetchedAt: new Date().toISOString(),
    ref,
  };
  await writeStamp(stamp).catch(() => undefined);

  return { root, updated: true };
}

/** Last commit time from a local clone (ISO), or null. */
export async function cloneHeadCommittedAt(
  registry: SkillRegistry,
  options: { git?: GitRunner } = {}
): Promise<string | null> {
  const git = options.git ?? defaultGitRunner;
  const root = registryClonePath(registry);
  if (!(await isGitRepo(root, git))) return null;
  try {
    const { stdout } = await git(['log', '-1', '--format=%cI'], { cwd: root });
    const iso = stdout.trim();
    return iso || null;
  } catch {
    return null;
  }
}

export type { SkillHost };
