import fs from 'node:fs/promises';
import path from 'node:path';
import {
  fetchSkillBundle,
  listRemoteSkills,
  resolveSkillEntry,
} from './github.js';
import type { FetchLike } from './github.js';
import type {
  InstallSkillResult,
  SkillBundle,
  SkillIndexEntry,
  SkillRegistry,
} from './types.js';

export type InstallSkillsOptions = {
  registry: SkillRegistry;
  skillIds: string[];
  /** Cursor project config root (default .cursor) */
  destination: string;
  force?: boolean;
  cwd?: string;
  fetchImpl?: FetchLike;
  /** Optional pre-fetched remote index (avoids a second list call) */
  remoteIndex?: SkillIndexEntry[];
};

function normalizeDestination(destination: string, cwd: string): string {
  const trimmed = destination.trim() || '.cursor';
  return path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(cwd, trimmed);
}

/** Install path uses leaf id only (slashes → nested dirs under .cursor/skills). */
function localSkillDir(skillsRoot: string, skillId: string): string {
  return path.join(skillsRoot, ...skillId.split('/').filter(Boolean));
}

export async function installSkills(
  options: InstallSkillsOptions
): Promise<{ destination: string; results: InstallSkillResult[] }> {
  const cwd = options.cwd ?? process.cwd();
  const destination = normalizeDestination(options.destination, cwd);
  const skillsRoot = path.join(destination, 'skills');
  await fs.mkdir(skillsRoot, { recursive: true });

  const remote =
    options.remoteIndex ??
    (await listRemoteSkills(options.registry, {
      fetchImpl: options.fetchImpl,
    }));

  const results: InstallSkillResult[] = [];

  for (const skillId of options.skillIds) {
    const entry = resolveSkillEntry(remote, skillId);
    if (!entry) {
      throw new Error(
        `Unknown skill "${skillId}" in registry "${options.registry.id}"`
      );
    }
    const skillDir = localSkillDir(skillsRoot, entry.id);
    const skillMd = path.join(skillDir, 'SKILL.md');

    let exists = false;
    try {
      await fs.access(skillMd);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists && !options.force) {
      results.push({
        id: entry.id,
        path: skillDir,
        status: 'skipped',
        filesWritten: 0,
      });
      continue;
    }

    const files = await fetchSkillBundle(options.registry, entry.id, {
      fetchImpl: options.fetchImpl,
      resolvedPath: entry.path,
    });
    const bundle: SkillBundle = {
      id: entry.id,
      registryId: options.registry.id,
      files,
    };

    if (exists && options.force) {
      await fs.rm(skillDir, { recursive: true, force: true });
    }
    await fs.mkdir(skillDir, { recursive: true });

    for (const file of bundle.files) {
      const dest = path.join(skillDir, file.relativePath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, file.content, 'utf-8');
    }

    results.push({
      id: entry.id,
      path: skillDir,
      status: exists ? 'updated' : 'created',
      filesWritten: bundle.files.length,
    });
  }

  return { destination, results };
}
