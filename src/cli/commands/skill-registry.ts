import chalk from 'chalk';
import type { SkillHost } from '../../skills/types.js';
import {
  addUserRegistry,
  listRegistries,
  parseRepoSource,
  removeUserRegistry,
} from '../../skills/registries.js';

export async function skillRegistryListCommand(options: {
  json?: boolean;
}): Promise<void> {
  const regs = await listRegistries();
  if (options.json) {
    console.log(JSON.stringify(regs, null, 2));
    return;
  }
  console.log();
  console.log(chalk.bold('Skill registries'));
  for (const r of regs) {
    const tag = r.builtin ? chalk.dim('builtin') : chalk.cyan('user');
    const host = r.host ?? 'github';
    const nested = r.nested ? chalk.dim(' nested') : '';
    console.log(
      `  ${r.id.padEnd(24)} ${tag}  ${host}:${r.github}/${r.skillsPath}@${r.ref}${nested}`
    );
    if (r.description) console.log(chalk.dim(`    ${r.description}`));
  }
  console.log();
}

export async function skillRegistryAddCommand(options: {
  id: string;
  source: string;
  path?: string;
  ref?: string;
  host?: string;
  nested?: boolean;
  label?: string;
  description?: string;
}): Promise<void> {
  const parsed = parseRepoSource(options.source);
  const host = (options.host?.trim() || parsed.host || 'github') as SkillHost;
  const skillsPath =
    options.path?.trim() || parsed.skillsPath || 'skills';
  const ref = options.ref?.trim() || parsed.ref || 'main';
  const id = options.id.trim();
  if (!id) throw new Error('Registry id is required');

  const registry = await addUserRegistry({
    id,
    label: options.label?.trim() || id,
    description: options.description?.trim() || '',
    host,
    github: parsed.github,
    skillsPath,
    ref,
    nested: options.nested === true,
  });

  console.log();
  console.log(chalk.green(`Added skill registry "${registry.id}"`));
  console.log(
    `  ${registry.host ?? 'github'}:${registry.github}/${registry.skillsPath}@${registry.ref}` +
      (registry.nested ? ' (nested)' : '')
  );
  console.log(
    chalk.dim(
      `  List: prompt-exporter skill-install --registry ${registry.id} --list`
    )
  );
  console.log();
}

export async function skillRegistryRemoveCommand(id: string): Promise<void> {
  await removeUserRegistry(id.trim());
  console.log(chalk.green(`Removed skill registry "${id.trim()}"`));
}
