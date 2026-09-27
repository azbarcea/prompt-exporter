import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchSkillBundle } from './github.js';
import type { FetchLike } from './github.js';
import type {
  InstallSkillResult,
  SkillBundle,
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
};

function normalizeDestination(destination: string, cwd: string): string {
  const trimmed = destination.trim() || '.cursor';
  return path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(cwd, trimmed);
}

export async function installSkills(
  options: InstallSkillsOptions
): Promise<{ destination: string; results: InstallSkillResult[] }> {
  const cwd = options.cwd ?? process.cwd();
  const destination = normalizeDestination(options.destination, cwd);
  const skillsRoot = path.join(destination, 'skills');
  await fs.mkdir(skillsRoot, { recursive: true });

  const results: InstallSkillResult[] = [];

  for (const skillId of options.skillIds) {
    const skillDir = path.join(skillsRoot, skillId);
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
        id: skillId,
        path: skillDir,
        status: 'skipped',
        filesWritten: 0,
      });
      continue;
    }

    const files = await fetchSkillBundle(options.registry, skillId, {
      fetchImpl: options.fetchImpl,
    });
    const bundle: SkillBundle = {
      id: skillId,
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
      id: skillId,
      path: skillDir,
      status: exists ? 'updated' : 'created',
      filesWritten: bundle.files.length,
    });
  }

  return { destination, results };
}
