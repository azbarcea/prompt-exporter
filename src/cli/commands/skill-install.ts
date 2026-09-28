import chalk from 'chalk';
import {
  listRemoteSkills,
  resolveSkillEntry,
} from '../../skills/github.js';
import { installSkills } from '../../skills/install.js';
import {
  getRegistry,
  resolveRegistryId,
} from '../../skills/registries.js';
import {
  agentFromDestination,
  formatAgents,
  registryAgents,
  registrySupportsAgent,
} from '../../skills/agents.js';
import type { SkillAgent } from '../../skills/types.js';
import { confirmConvertForAgent } from './skill-registry.js';
import { parseCommaIds } from '../../utils/parse-ids.js';

const KNOWN_AGENTS = new Set<SkillAgent>([
  'cursor',
  'claude-code',
  'codex',
  'opencode',
  'gitlab-duo',
  'copilot',
  'gemini-cli',
  'any',
]);

function parseAgentOption(raw?: string): SkillAgent | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (!KNOWN_AGENTS.has(value as SkillAgent)) {
    throw new Error(
      `Unknown agent "${raw}". Use one of: ${[...KNOWN_AGENTS].join(', ')}`
    );
  }
  return value as SkillAgent;
}

export type SkillInstallCommandOptions = {
  registry?: string;
  destination?: string;
  force?: boolean;
  list?: boolean;
  all?: boolean;
  descriptions?: boolean;
  json?: boolean;
  convert?: boolean;
  noConvert?: boolean;
  agent?: string;
  skills?: string[];
};

export async function skillInstallCommand(
  options: SkillInstallCommandOptions
): Promise<void> {
  const registryId = resolveRegistryId(options.registry);
  const registry = await getRegistry(registryId);
  const host = registry.host ?? 'github';
  const agents = registryAgents(registry);

  if (options.list) {
    try {
      const skills = await listRemoteSkills(registry, {
        withDescriptions: options.descriptions === true,
      });
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              registry: {
                id: registry.id,
                host,
                github: registry.github,
                skillsPath: registry.skillsPath,
                ref: registry.ref,
                nested: !!registry.nested,
                agents,
              },
              skills,
            },
            null,
            2
          )
        );
        return;
      }
      console.log();
      console.log(
        chalk.bold(`Skills in ${registry.id}`) +
          chalk.dim(
            ` (${host}:${registry.github}/${registry.skillsPath}@${registry.ref}` +
              (registry.nested ? ', nested' : '') +
              ')'
          )
      );
      console.log(chalk.dim(`  agents: ${formatAgents(agents)}`));
      for (const s of skills) {
        if (s.description) {
          console.log(`  ${s.id.padEnd(36)} ${s.description}`);
        } else {
          console.log(`  ${s.id}`);
        }
      }
      console.log();
      console.log(chalk.dim(`  ${skills.length} skill(s)`));
      console.log();
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(msg));
      if (/rate limit/i.test(msg)) {
        console.error(
          chalk.yellow(
            'Tip: export PROMPT_EXPORTER_GITHUB_TOKEN or GITHUB_TOKEN, then retry.'
          )
        );
      }
      process.exitCode = 1;
      return;
    }
  }

  let skillIds = parseCommaIds(options.skills ?? []);
  let remote;
  try {
    remote = await listRemoteSkills(registry);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(msg));
    if (/rate limit/i.test(msg)) {
      console.error(
        chalk.yellow(
          'Tip: export PROMPT_EXPORTER_GITHUB_TOKEN or GITHUB_TOKEN, then retry.'
        )
      );
    }
    process.exitCode = 1;
    return;
  }

  if (options.all) {
    skillIds = remote.map((s) => s.id);
  }
  if (skillIds.length === 0) {
    throw new Error(
      'Specify skill id(s), or use --all. Tip: prompt-exporter skill-install --list'
    );
  }

  const missing = skillIds.filter((id) => !resolveSkillEntry(remote, id));
  if (missing.length) {
    throw new Error(
      `Unknown skill(s) in registry "${registryId}": ${missing.join(', ')}`
    );
  }

  const destination = options.destination?.trim() || '.cursor';
  const destinationAgent =
    parseAgentOption(options.agent) ?? agentFromDestination(destination);

  let convertForAgent: SkillAgent | undefined;
  if (!registrySupportsAgent(registry, destinationAgent)) {
    const shouldConvert = await confirmConvertForAgent({
      registryId: registry.id,
      agents,
      destinationAgent,
      convert: options.convert,
      noConvert: options.noConvert,
    });
    if (shouldConvert) {
      convertForAgent = destinationAgent;
      console.log(
        chalk.dim(
          `  Converting SKILL.md for ${destinationAgent} (registry targets: ${formatAgents(agents)})`
        )
      );
    } else {
      console.log(
        chalk.dim(
          `  Installing as-is (registry targets: ${formatAgents(agents)}; destination: ${destinationAgent})`
        )
      );
    }
  }

  const { destination: destAbs, results } = await installSkills({
    registry,
    skillIds,
    destination,
    force: options.force === true,
    remoteIndex: remote,
    convertForAgent,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          registry: registryId,
          destination: destAbs,
          destinationAgent,
          converted: !!convertForAgent,
          results,
        },
        null,
        2
      )
    );
    return;
  }

  console.log();
  console.log(
    chalk.bold('Installed skills') + chalk.dim(` (registry: ${registryId})`)
  );
  console.log(`  Destination: ${destAbs}/skills`);
  console.log(chalk.dim(`  Agent: ${destinationAgent}`));
  for (const r of results) {
    const tag =
      r.status === 'created'
        ? chalk.green('[created]')
        : r.status === 'updated'
          ? chalk.yellow('[updated]')
          : chalk.dim('[skipped]');
    const extra =
      r.filesWritten > 0 ? chalk.dim(` (${r.filesWritten} files)`) : '';
    const conv = r.converted ? chalk.cyan(' [converted]') : '';
    console.log(`  ${tag} ${r.id} → ${r.path}${extra}${conv}`);
  }
  const skipped = results.filter((r) => r.status === 'skipped').length;
  if (skipped > 0 && !options.force) {
    console.log();
    console.log(
      chalk.dim(
        `  ${skipped} existing skill(s) left unchanged. Re-run with --force to overwrite.`
      )
    );
  }
  console.log();
}
