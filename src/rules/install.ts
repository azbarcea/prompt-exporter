import fs from 'node:fs/promises';
import path from 'node:path';
import type { RuleTemplate } from './types.js';

export type InstallRuleResult = {
  id: string;
  path: string;
  status: 'created' | 'updated' | 'skipped';
};

export type InstallRulesOptions = {
  /** Cursor project config root (default: .cursor under cwd) */
  destination: string;
  rules: RuleTemplate[];
  /** Overwrite existing .mdc files */
  force?: boolean;
  cwd?: string;
};

function normalizeDestination(destination: string, cwd: string): string {
  const trimmed = destination.trim() || '.cursor';
  return path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(cwd, trimmed);
}

/**
 * Install rule .mdc files under {destination}/rules/ and ensure companion dirs.
 */
export async function installRules(
  options: InstallRulesOptions
): Promise<{ destination: string; results: InstallRuleResult[] }> {
  const cwd = options.cwd ?? process.cwd();
  const destination = normalizeDestination(options.destination, cwd);
  const rulesDir = path.join(destination, 'rules');
  await fs.mkdir(rulesDir, { recursive: true });

  const ensureDirs = new Set<string>();
  for (const rule of options.rules) {
    for (const d of rule.ensureDirs ?? []) {
      ensureDirs.add(d);
    }
  }
  for (const d of ensureDirs) {
    await fs.mkdir(path.join(destination, d), { recursive: true });
  }

  const results: InstallRuleResult[] = [];
  for (const rule of options.rules) {
    const filePath = path.join(rulesDir, rule.filename);
    let exists = false;
    try {
      await fs.access(filePath);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists && !options.force) {
      results.push({ id: rule.id, path: filePath, status: 'skipped' });
      continue;
    }

    await fs.writeFile(filePath, rule.content, 'utf-8');
    results.push({
      id: rule.id,
      path: filePath,
      status: exists ? 'updated' : 'created',
    });
  }

  return { destination, results };
}
