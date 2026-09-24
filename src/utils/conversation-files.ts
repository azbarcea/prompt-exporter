import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConversationDetail } from '../sources/chatgpt/api/types.js';

/** JSON lives under conversations/json/; markdown at conversations/*.md */
export function conversationsRoot(outputDir: string, projectName?: string): string {
  if (projectName) {
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(outputDir, 'projects', safeName, 'conversations');
  }
  return path.join(outputDir, 'conversations');
}

export function jsonDir(conversationsDir: string): string {
  return path.join(conversationsDir, 'json');
}

export function jsonPathForId(conversationsDir: string, id: string): string {
  return path.join(jsonDir(conversationsDir), `${id}.json`);
}

export function indexPath(conversationsDir: string): string {
  return path.join(jsonDir(conversationsDir), 'index.json');
}

/** Normalize ChatGPT timestamps (unix seconds, ms, or ISO string) to Date. */
export function toDate(value: number | string | null | undefined): Date | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    // Heuristic: ms vs seconds
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const asNum = Number(value);
  if (Number.isFinite(asNum) && value.trim() !== '') {
    return toDate(asNum);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Prefix used for menu-order filenames: YYYY-mm-dd-HHMM */
export function formatUpdateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${hh}${mm}`;
}

/**
 * Safe title for filenames: keep spaces, strip path/control chars.
 */
export function sanitizeTitleForFilename(title: string | null | undefined): string {
  const base = (title?.trim() || 'Untitled')
    .replace(/[/\\]/g, '-')
    .replace(/[:*?"<>|]/g, '-')
    .replace(/[\0\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  return base || 'Untitled';
}

export function markdownFilename(
  detail: Pick<ConversationDetail, 'title' | 'update_time' | 'create_time'>
): string {
  const date =
    toDate(detail.update_time) ?? toDate(detail.create_time) ?? new Date(0);
  const stamp = formatUpdateStamp(date);
  const title = sanitizeTitleForFilename(detail.title);
  return `${stamp}.${title}.md`;
}

export type ConversationFrontmatter = {
  id: string;
  title: string;
  updated: string | null;
  created: string | null;
  json: string;
};

export function buildFrontmatter(meta: ConversationFrontmatter): string {
  const lines = ['---'];
  lines.push(`id: ${yamlScalar(meta.id)}`);
  lines.push(`title: ${yamlScalar(meta.title)}`);
  if (meta.updated) lines.push(`updated: ${yamlScalar(meta.updated)}`);
  if (meta.created) lines.push(`created: ${yamlScalar(meta.created)}`);
  lines.push(`json: ${yamlScalar(meta.json)}`);
  lines.push('---');
  return lines.join('\n');
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value) && !value.includes(':')) {
    return value;
  }
  return JSON.stringify(value);
}

export function relativeJsonFromMd(id: string): string {
  return path.posix.join('json', `${id}.json`);
}

export function isoOrNull(value: number | string | null | undefined): string | null {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

async function listJsonInDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        entry.name !== 'index.json'
      ) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // missing dir
  }
  return files;
}

/** Prefer conversations/json/<id>.json; fall back to legacy conversations/<id>.json. */
export async function collectAllJsonFiles(inputDir: string): Promise<string[]> {
  const byId = new Map<string, { path: string; preferred: boolean }>();

  const consider = (filePath: string, preferred: boolean) => {
    const id = path.basename(filePath, '.json');
    const prev = byId.get(id);
    if (!prev || (preferred && !prev.preferred)) {
      byId.set(id, { path: filePath, preferred });
    }
  };

  const roots = [conversationsRoot(inputDir)];
  try {
    const projectsDir = path.join(inputDir, 'projects');
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        roots.push(conversationsRoot(inputDir, entry.name));
      }
    }
  } catch {
    // no projects
  }

  for (const root of roots) {
    for (const f of await listJsonInDir(jsonDir(root))) {
      consider(f, true);
    }
    for (const f of await listJsonInDir(root)) {
      consider(f, false);
    }
  }

  return [...byId.values()].map((v) => v.path);
}
