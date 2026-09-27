import chalk from 'chalk';
import {
  addUserRegistry,
  listRegistries,
  parseGithubSource,
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
    console.log(
      `  ${r.id.padEnd(24)} ${tag}  ${r.github}/${r.skillsPath}@${r.ref}`
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
  label?: string;
  description?: string;
}): Promise<void> {
  const parsed = parseGithubSource(options.source);
  const skillsPath =
    options.path?.trim() ||
    parsed.skillsPath ||
    'skills';
  const ref = options.ref?.trim() || parsed.ref || 'main';
  const id = options.id.trim();
  if (!id) throw new Error('Registry id is required');

  const registry = await addUserRegistry({
    id,
    label: options.label?.trim() || id,
    description: options.description?.trim() || '',
    github: parsed.github,
    skillsPath,
    ref,
  });

  console.log();
  console.log(chalk.green(`Added skill registry "${registry.id}"`));
  console.log(
    `  ${registry.github}/${registry.skillsPath}@${registry.ref}`
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
