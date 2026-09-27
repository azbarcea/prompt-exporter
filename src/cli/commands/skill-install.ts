import chalk from 'chalk';
import { listRemoteSkills } from '../../skills/github.js';
import { installSkills } from '../../skills/install.js';
import {
  getRegistry,
  resolveRegistryId,
} from '../../skills/registries.js';
import { parseCommaIds } from '../../utils/parse-ids.js';

export type SkillInstallCommandOptions = {
  registry?: string;
  destination?: string;
  force?: boolean;
  list?: boolean;
  all?: boolean;
  descriptions?: boolean;
  json?: boolean;
  skills?: string[];
};

export async function skillInstallCommand(
  options: SkillInstallCommandOptions
): Promise<void> {
  const registryId = resolveRegistryId(options.registry);
  const registry = await getRegistry(registryId);

  if (options.list) {
    const skills = await listRemoteSkills(registry, {
      withDescriptions: options.descriptions === true,
    });
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            registry: {
              id: registry.id,
              github: registry.github,
              skillsPath: registry.skillsPath,
              ref: registry.ref,
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
          ` (${registry.github}/${registry.skillsPath}@${registry.ref})`
        )
    );
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
  }

  let skillIds = parseCommaIds(options.skills ?? []);
  if (options.all) {
    const remote = await listRemoteSkills(registry);
    skillIds = remote.map((s) => s.id);
  }
  if (skillIds.length === 0) {
    throw new Error(
      'Specify skill id(s), or use --all. Tip: prompt-exporter skill-install --list'
    );
  }

  // Validate ids exist remotely (fail fast on typos)
  const remote = await listRemoteSkills(registry);
  const known = new Set(remote.map((s) => s.id));
  const missing = skillIds.filter((id) => !known.has(id));
  if (missing.length) {
    throw new Error(
      `Unknown skill(s) in registry "${registryId}": ${missing.join(', ')}`
    );
  }

  const destination = options.destination?.trim() || '.cursor';
  const { destination: destAbs, results } = await installSkills({
    registry,
    skillIds,
    destination,
    force: options.force === true,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        { registry: registryId, destination: destAbs, results },
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
  for (const r of results) {
    const tag =
      r.status === 'created'
        ? chalk.green('[created]')
        : r.status === 'updated'
          ? chalk.yellow('[updated]')
          : chalk.dim('[skipped]');
    const extra =
      r.filesWritten > 0 ? chalk.dim(` (${r.filesWritten} files)`) : '';
    console.log(`  ${tag} ${r.id} → ${r.path}${extra}`);
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
