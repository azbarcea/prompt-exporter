import chalk from 'chalk';
import {
  getRulePack,
  listRulePacks,
  parseRuleIds,
  resolveRulePackId,
  resolveRules,
} from '../../rules/catalog.js';
import { installRules } from '../../rules/install.js';

export type RuleInstallCommandOptions = {
  source?: string;
  destination?: string;
  force?: boolean;
  list?: boolean;
  json?: boolean;
  /** Positional / comma-separated rule ids; empty → all in pack */
  rules?: string[];
};

export async function ruleInstallCommand(
  options: RuleInstallCommandOptions
): Promise<void> {
  const sourceId = resolveRulePackId(options.source);

  if (options.list) {
    const packs = options.source
      ? [getRulePack(sourceId)]
      : listRulePacks();
    if (options.json) {
      console.log(
        JSON.stringify(
          packs.map((p) => ({
            id: p.id,
            label: p.label,
            description: p.description,
            rules: p.rules.map((r) => ({
              id: r.id,
              filename: r.filename,
              description: r.description,
            })),
          })),
          null,
          2
        )
      );
      return;
    }
    console.log();
    for (const pack of packs) {
      console.log(
        chalk.bold(`  ${pack.id}`) + chalk.dim(` — ${pack.description}`)
      );
      for (const rule of pack.rules) {
        console.log(
          `    ${rule.id.padEnd(18)} ${rule.description}`
        );
      }
      console.log();
    }
    return;
  }

  const pack = getRulePack(sourceId);
  const requested = parseRuleIds(options.rules ?? []);
  const rules = resolveRules(pack, requested);
  const destination = options.destination?.trim() || '.cursor';

  const { destination: destAbs, results } = await installRules({
    destination,
    rules,
    force: options.force === true,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          source: sourceId,
          destination: destAbs,
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
    chalk.bold('Installed Cursor rules') +
      chalk.dim(` (source: ${sourceId})`)
  );
  console.log(`  Destination: ${destAbs}`);
    for (const r of results) {
      const tag =
        r.status === 'created'
          ? chalk.green('[created]')
          : r.status === 'updated'
            ? chalk.yellow('[updated]')
            : chalk.dim('[skipped]');
      console.log(`  ${tag} ${r.id} → ${r.path}`);
    }
  const skipped = results.filter((r) => r.status === 'skipped').length;
  if (skipped > 0 && !options.force) {
    console.log();
    console.log(
      chalk.dim(
        `  ${skipped} existing file(s) left unchanged. Re-run with --force to overwrite.`
      )
    );
  }
  console.log();
}
