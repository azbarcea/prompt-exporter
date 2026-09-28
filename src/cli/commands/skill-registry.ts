import chalk from 'chalk';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { formatAgents, registryAgents } from '../../skills/agents.js';
import { getRepoActivities } from '../../skills/activity.js';
import { formatRelativeTime } from '../../skills/relative-time.js';
import type { SkillAgent, SkillHost } from '../../skills/types.js';
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
  const activities = await getRepoActivities(regs);

  if (options.json) {
    console.log(
      JSON.stringify(
        regs.map((r) => {
          const activity = activities.get(r.id) ?? null;
          return {
            ...r,
            agents: registryAgents(r),
            lastCommitAt: activity?.pushedAt ?? null,
            lastCommitRelative: activity
              ? formatRelativeTime(activity.pushedAt)
              : null,
          };
        }),
        null,
        2
      )
    );
    return;
  }

  console.log();
  console.log(chalk.bold('Skill registries'));
  for (const r of regs) {
    const tag = r.builtin ? chalk.dim('builtin') : chalk.cyan('user');
    const host = r.host ?? 'github';
    const nested = r.nested ? chalk.dim(' nested') : '';
    const agents = formatAgents(registryAgents(r));
    const activity = activities.get(r.id);
    const when = activity
      ? chalk.dim(` · updated ${formatRelativeTime(activity.pushedAt)}`)
      : chalk.dim(' · updated unknown');

    console.log(
      `  ${r.id.padEnd(24)} ${tag}  ${host}:${r.github}/${r.skillsPath}@${r.ref}${nested}${when}`
    );
    console.log(chalk.dim(`    agents: ${agents}`));
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
  agents?: string;
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

  const agents = options.agents
    ?.split(/[, ]+/)
    .map((a) => a.trim())
    .filter(Boolean) as SkillAgent[] | undefined;

  const registry = await addUserRegistry({
    id,
    label: options.label?.trim() || id,
    description: options.description?.trim() || '',
    host,
    github: parsed.github,
    skillsPath,
    ref,
    nested: options.nested === true,
    agents,
  });

  console.log();
  console.log(chalk.green(`Added skill registry "${registry.id}"`));
  console.log(
    `  ${registry.host ?? 'github'}:${registry.github}/${registry.skillsPath}@${registry.ref}` +
      (registry.nested ? ' (nested)' : '')
  );
  console.log(chalk.dim(`  agents: ${formatAgents(registryAgents(registry))}`));
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

/** Ask whether to convert when registry agents don't match destination. */
export async function confirmConvertForAgent(options: {
  registryId: string;
  agents: SkillAgent[];
  destinationAgent: SkillAgent;
  convert?: boolean;
  noConvert?: boolean;
}): Promise<boolean> {
  if (options.noConvert) return false;
  if (options.convert) return true;
  if (
    options.agents.includes('any') ||
    options.agents.includes(options.destinationAgent)
  ) {
    return false;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `Registry "${options.registryId}" targets [${options.agents.join(', ')}], ` +
        `but destination is for ${options.destinationAgent}. ` +
        `Re-run with --convert to adapt SKILL.md for ${options.destinationAgent}, ` +
        `or --as-is to install without converting.`
    );
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      chalk.yellow(
        `Registry targets [${options.agents.join(', ')}], destination is ${options.destinationAgent}. Convert SKILL.md for ${options.destinationAgent}? [y/N] `
      )
    );
    return /^\s*y(es)?\s*$/i.test(answer);
  } finally {
    rl.close();
  }
}
