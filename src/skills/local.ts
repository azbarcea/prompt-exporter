import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillFile, SkillIndexEntry, SkillRegistry } from './types.js';

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDir(filePath: string): Promise<boolean> {
  try {
    const st = await fs.stat(filePath);
    return st.isDirectory();
  } catch {
    return false;
  }
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

async function dirHasSkillMd(absDir: string): Promise<boolean> {
  return exists(path.join(absDir, 'SKILL.md'));
}

function parseDescription(skillMd: string): string | undefined {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
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
 * List skills from a local clone (or any checkout) of a registry repo.
 */
export async function listSkillsFromClone(
  cloneRoot: string,
  registry: SkillRegistry,
  options: { withDescriptions?: boolean } = {}
): Promise<SkillIndexEntry[]> {
  const skillsAbs = path.join(cloneRoot, ...registry.skillsPath.split('/'));
  if (!(await isDir(skillsAbs))) {
    throw new Error(
      `Skills path "${registry.skillsPath}" not found in local clone of ${registry.github}`
    );
  }

  const top = await fs.readdir(skillsAbs, { withFileTypes: true });
  const found: SkillIndexEntry[] = [];

  for (const ent of top) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const abs = path.join(skillsAbs, ent.name);
    const rel = path.posix.join(registry.skillsPath, ent.name);
    if (await dirHasSkillMd(abs)) {
      found.push({ id: ent.name, path: rel });
      continue;
    }
    if (!registry.nested) continue;
    const children = await fs.readdir(abs, { withFileTypes: true });
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith('.')) continue;
      const childAbs = path.join(abs, child.name);
      if (await dirHasSkillMd(childAbs)) {
        found.push({
          id: child.name,
          path: path.posix.join(rel, child.name),
        });
      }
    }
  }

  const entries = assignUniqueIds(found);

  if (options.withDescriptions) {
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const md = await fs.readFile(
            path.join(cloneRoot, ...entry.path.split('/'), 'SKILL.md'),
            'utf-8'
          );
          entry.description = parseDescription(md);
        } catch {
          // optional
        }
      })
    );
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Read all files under a skill folder from a local clone.
 */
export async function fetchSkillBundleFromClone(
  cloneRoot: string,
  skillPath: string
): Promise<SkillFile[]> {
  const rootAbs = path.join(cloneRoot, ...skillPath.split('/').filter(Boolean));
  if (!(await isDir(rootAbs))) {
    throw new Error(`Skill path "${skillPath}" not found in local clone`);
  }

  const files: SkillFile[] = [];

  async function walk(absDir: string, relBase: string): Promise<void> {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git' || ent.name.startsWith('.')) continue;
      const abs = path.join(absDir, ent.name);
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!ent.isFile()) continue;
      const content = await fs.readFile(abs, 'utf-8');
      files.push({ relativePath: rel, content });
    }
  }

  await walk(rootAbs, '');

  if (!files.some((f) => f.relativePath === 'SKILL.md')) {
    throw new Error(`Skill path "${skillPath}" has no SKILL.md`);
  }

  return files;
}
