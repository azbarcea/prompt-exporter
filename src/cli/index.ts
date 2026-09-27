import { Command } from 'commander';
import { backupCommand } from './commands/backup.js';
import { lumoBackupCommand, lumoListCommand } from './commands/backup-lumo.js';
import {
  perplexityBackupCommand,
  perplexityListCommand,
} from './commands/backup-perplexity.js';
import { chromiumStartCommand } from './commands/chromium.js';
import { listCommand } from './commands/list.js';
import { projectsCommand } from './commands/projects.js';
import { ruleInstallCommand } from './commands/rule-install.js';
import { skillInstallCommand } from './commands/skill-install.js';
import {
  skillRegistryAddCommand,
  skillRegistryListCommand,
  skillRegistryRemoveCommand,
} from './commands/skill-registry.js';
import { tokenCommand } from './commands/token.js';
import { loadSavedToken } from '../utils/credentials.js';
import {
  DEFAULT_CDP_PORT,
  DEFAULT_SOURCE_ID,
  ensureHomeLayout,
  getSourceDataDir,
} from '../utils/paths.js';
import { getSource, listSources, resolveSourceId } from '../sources/registry.js';
import { getPackageVersion } from '../utils/package-version.js';
import { listRulePacks } from '../rules/catalog.js';
import { DEFAULT_SKILL_REGISTRY_ID } from '../skills/registries.js';
function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('prompt-exporter')
    .description(
      'Export and sync AI conversation prompts from multiple sources to local JSON + Markdown'
    )
    .version(getPackageVersion())
    .hook('preAction', async () => {
      await ensureHomeLayout();
    })
    .addHelpText(
      'after',
      [
        '',
        'Environment:',
        '  PROMPT_EXPORTER_HOME           Override ~/.prompt-exporter',
        '  PROMPT_EXPORTER_DATA            Parent of source dirs (default: home)',
        '  PROMPT_EXPORTER_BROWSER         Chromium binary path',
        '  PROMPT_EXPORTER_CDP_PORT        Preferred CDP port (auto-discovers 9222/9223/…)',
        '  PROMPT_EXPORTER_CHATGPT_TOKEN  Optional Bearer fallback for chatgpt source',
        '  PROMPT_EXPORTER_GITHUB_TOKEN   Optional GitHub token for skill-install API',
        '  PROMPT_EXPORTER_GITLAB_TOKEN   Optional GitLab token for skill-install API',
        '',
        'Typical flow:',
        '  prompt-exporter chromium start',
        '  prompt-exporter sync --source chatgpt',
        '  prompt-exporter chromium start --url https://lumo.proton.me/',
        '  prompt-exporter sync --source lumo',
        '  prompt-exporter chromium start --url https://www.perplexity.ai/',
        '  prompt-exporter sync --source perplexity',
        '  prompt-exporter rule-install --source cursor',
        '  prompt-exporter skill-install --registry awesome-cursor-skills --list',
        '',
        'Data: ~/.prompt-exporter/{source}/conversations/',
      ].join('\n')
    )
    .action(() => {
      program.help();
    });

  const resolveOptionalToken = async (options: {
    token?: string;
    source?: string;
  }): Promise<string | undefined> => {
    if (options.token?.trim()) return options.token.trim();
    const sourceId = resolveSourceId(options.source);
    if (sourceId === 'chatgpt') {
      if (process.env.PROMPT_EXPORTER_CHATGPT_TOKEN?.trim()) {
        return process.env.PROMPT_EXPORTER_CHATGPT_TOKEN.trim();
      }
      if (process.env.CHATGPT_TOKEN?.trim()) {
        return process.env.CHATGPT_TOKEN.trim();
      }
    }
    return (await loadSavedToken(sourceId)) ?? undefined;
  };

  const resolveOutput = (options: {
    output?: string;
    source?: string;
  }): string => {
    if (options.output?.trim()) return options.output.trim();
    return getSource(resolveSourceId(options.source)).defaultDataDir();
  };

  const sourceOption = (cmd: Command): Command =>
    cmd.option(
      '-s, --source <id>',
      'Prompt source',
      DEFAULT_SOURCE_ID
    );

  program
    .command('sources')
    .description('List available prompt sources')
    .option('--json', 'Output as JSON', false)
    .action((options) => {
      const rows = listSources();
      if (options.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      console.log();
      for (const s of rows) {
        console.log(`  ${s.id.padEnd(12)} ${s.label} — ${s.description}`);
      }
      console.log();
    });

  const chromium = program
    .command('chromium')
    .description('Manage Chromium with remote debugging (CDP)');

  chromium
    .command('start')
    .description(
      `Start Chromium with remote debugging (default port ${DEFAULT_CDP_PORT})`
    )
    .option(
      '--port <PORT>',
      'Remote debugging (CDP) port',
      parsePort,
      DEFAULT_CDP_PORT
    )
    .option(
      '--isolated',
      'Use a separate empty profile under ~/.prompt-exporter/chromium',
      false
    )
    .option(
      '--user-data-dir <dir>',
      'Chromium user-data-dir (default: system profile, e.g. ~/.config/chromium)'
    )
    .option('--headless', 'Run Chromium headless', false)
    .option('--url <url>', 'Initial URL', 'https://chatgpt.com/')
    .option('--force', 'Start even if CDP is already running on the port', false)
    .option('--print', 'Print resolved browser path and args', false)
    .addHelpText(
      'after',
      [
        '',
        'If Chromium is already running with CDP on this port, it is reused.',
        'Otherwise starts Chromium with your system profile.',
        '',
        'Examples:',
        '  prompt-exporter chromium start',
        '  prompt-exporter chromium start --port 9222',
        '  prompt-exporter chromium start --url https://lumo.proton.me/',
        '  prompt-exporter chromium start --isolated',
      ].join('\n')
    )
    .action(async (options) => {
      await chromiumStartCommand({
        port: options.port,
        headless: options.headless,
        url: options.url,
        print: options.print,
        force: options.force,
        isolated: options.isolated,
        userDataDir: options.userDataDir,
      });
    });

  sourceOption(
    program
      .command('token')
      .description('Get accessToken from the CDP Chromium session (chatgpt)')
      .option(
        '--port <PORT>',
        'CDP port of an already-running Chromium',
        parsePort,
        DEFAULT_CDP_PORT
      )
      .option(
        '--no-wait',
        'Do not wait for interactive login; exit immediately if not logged in'
      )
      .option(
        '--timeout <ms>',
        'Login wait timeout in ms',
        (v) => parseInt(v, 10),
        180000
      )
      .option('--print', 'Print resolved browser path', false)
      .option(
        '--show',
        'Print full export PROMPT_EXPORTER_CHATGPT_TOKEN=... line',
        false
      )
      .action(async (options) => {
        resolveSourceId(options.source);
        await tokenCommand({
          print: options.print,
          port: options.port,
          wait: options.wait !== false,
          timeoutMs: options.timeout,
          show: options.show,
        });
      })
  );

  const runBackup = async (options: {
    token?: string;
    output?: string;
    concurrency: number;
    delay: number;
    incremental: boolean;
    downloadFiles: boolean;
    verbose: boolean;
    project?: string;
    port?: number;
    source?: string;
  }) => {
    const sourceId = resolveSourceId(options.source);
    if (sourceId === 'lumo') {
      await lumoBackupCommand({
        output: resolveOutput(options),
        incremental: options.incremental,
        verbose: options.verbose,
        cdpPort: options.port,
      });
      return;
    }
    if (sourceId === 'perplexity') {
      await perplexityBackupCommand({
        output: resolveOutput(options),
        incremental: options.incremental,
        verbose: options.verbose,
        cdpPort: options.port,
        concurrency: options.concurrency,
        delay: options.delay,
      });
      return;
    }
    if (sourceId !== 'chatgpt') {
      throw new Error(
        `Source "${sourceId}" is registered but sync is not implemented yet`
      );
    }
    const token = await resolveOptionalToken(options);
    await backupCommand({
      token,
      output: resolveOutput(options),
      concurrency: options.concurrency,
      delay: options.delay,
      incremental: options.incremental,
      downloadFiles: options.downloadFiles,
      verbose: options.verbose,
      project: options.project,
      cdpPort: options.port,
    });
  };

  const backupOpts = (cmd: Command): Command =>
    sourceOption(cmd)
      .option(
        '-t, --token <token>',
        'Optional Bearer fallback; not needed with CDP'
      )
      .option(
        '--port <PORT>',
        'Preferred Chromium CDP port (auto-discovers if idle)',
        parsePort
      )
      .option(
        '-o, --output <dir>',
        'Source output directory (default: ~/.prompt-exporter/{source})'
      )
      .option(
        '--concurrency <n>',
        'Parallel downloads / CDP tabs (default 3, max 6)',
        (v) => parseInt(v, 10),
        3
      )
      .option(
        '--delay <ms>',
        'Min gap between starting requests in ms',
        (v) => parseInt(v, 10),
        200
      )
      .option(
        '--no-incremental',
        'Re-download all conversations (default: skip unchanged)'
      )
      .option('--download-files', 'Download file attachments and images', false)
      .option(
        '--project <name-or-id>',
        'Only backup conversations from a specific project'
      )
      .option('-v, --verbose', 'Verbose logging', false);

  backupOpts(
    program
      .command('sync')
      .description(
        `Sync conversations (default: ${getSourceDataDir(DEFAULT_SOURCE_ID)})`
      )
      .addHelpText(
        'after',
        [
          '',
          'Examples:',
          '  prompt-exporter sync',
          '  prompt-exporter sync --source chatgpt',
          '  prompt-exporter sync --source lumo',
          '  prompt-exporter sync --source perplexity',
          '  prompt-exporter sync --download-files',
          '  prompt-exporter sync --no-incremental',
        ].join('\n')
      )
      .action(async (options) => {
        await runBackup(options);
      })
  );

  backupOpts(
    program
      .command('backup')
      .description('Alias for sync')
      .action(async (options) => {
        await runBackup(options);
      })
  );

  sourceOption(
    program
      .command('list')
      .description('List conversations without downloading')
      .option('-t, --token <token>', 'Optional Bearer fallback')
      .option(
        '--port <PORT>',
        'Preferred Chromium CDP port (auto-discovers if idle)',
        parsePort
      )
      .option(
        '--delay <ms>',
        'Delay between requests in ms',
        (v) => parseInt(v, 10),
        500
      )
      .option(
        '--project <name-or-id>',
        'List conversations from a specific project'
      )
      .option('-v, --verbose', 'Verbose logging', false)
      .option('--json', 'Output as JSON', false)
      .action(async (options) => {
        const sourceId = resolveSourceId(options.source);
        if (sourceId === 'lumo') {
          await lumoListCommand({
            verbose: options.verbose,
            json: options.json,
            cdpPort: options.port,
          });
          return;
        }
        if (sourceId === 'perplexity') {
          await perplexityListCommand({
            verbose: options.verbose,
            json: options.json,
            cdpPort: options.port,
          });
          return;
        }
        if (sourceId !== 'chatgpt') {
          throw new Error(`Source "${sourceId}" list not implemented yet`);
        }
        const token = await resolveOptionalToken(options);
        await listCommand({
          token,
          delay: options.delay,
          verbose: options.verbose,
          json: options.json,
          project: options.project,
          cdpPort: options.port,
        });
      })
  );

  sourceOption(
    program
      .command('projects')
      .description('List all projects')
      .option('-t, --token <token>', 'Optional Bearer fallback')
      .option(
        '--port <PORT>',
        'Preferred Chromium CDP port (auto-discovers if idle)',
        parsePort
      )
      .option('-v, --verbose', 'Verbose logging', false)
      .option('--json', 'Output as JSON', false)
      .action(async (options) => {
        const sourceId = resolveSourceId(options.source);
        if (sourceId !== 'chatgpt') {
          throw new Error(`Source "${sourceId}" projects not implemented yet`);
        }
        const token = await resolveOptionalToken(options);
        await projectsCommand({
          token,
          verbose: options.verbose,
          json: options.json,
          cdpPort: options.port,
        });
      })
  );

  program
    .command('rule-install')
    .description(
      'Install Cursor workspace rules (plans/journals under .cursor/, not ~/.cursor)'
    )
    .argument(
      '[rules...]',
      'Rule ids (space or comma separated); omit to install all for --source'
    )
    .option(
      '-s, --source <id>',
      `Rule pack (${listRulePacks()
        .map((p) => p.id)
        .join('|')})`,
      'cursor'
    )
    .option(
      '-d, --destination <dir>',
      'Cursor project config root (rules written to <dir>/rules/)',
      '.cursor'
    )
    .option('--force', 'Overwrite existing rule files', false)
    .option('--list', 'List available rules for --source (no install)', false)
    .option('--json', 'Output as JSON', false)
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  prompt-exporter rule-install',
        '  prompt-exporter rule-install --source cursor --destination .cursor',
        '  prompt-exporter rule-install journal-logging,plans-location',
        '  prompt-exporter rule-install plans-location --force',
        '  prompt-exporter rule-install --list',
      ].join('\n')
    )
    .action(async (rules: string[], options) => {
      await ruleInstallCommand({
        source: options.source,
        destination: options.destination,
        force: options.force,
        list: options.list,
        json: options.json,
        rules,
      });
    });

  program
    .command('skill-install')
    .description(
      'Install Cursor agent skills from a skills registry into .cursor/skills/'
    )
    .argument(
      '[skills...]',
      'Skill ids (space or comma separated); required unless --list / --all'
    )
    .option(
      '-r, --registry <id>',
      `Skills registry (default: ${DEFAULT_SKILL_REGISTRY_ID})`,
      DEFAULT_SKILL_REGISTRY_ID
    )
    .option(
      '-d, --destination <dir>',
      'Cursor project config root (skills written to <dir>/skills/)',
      '.cursor'
    )
    .option('--force', 'Overwrite existing skill directories', false)
    .option(
      '--list',
      'List skills in --registry (default: awesome-cursor-skills)',
      false
    )
    .option(
      '--descriptions',
      'With --list, fetch SKILL.md descriptions (more API calls)',
      false
    )
    .option('--all', 'Install every skill in the registry', false)
    .option('--json', 'Output as JSON', false)
    .addHelpText(
      'after',
      [
        '',
        'Default registry: awesome-cursor-skills',
        '  https://github.com/spencerpauly/awesome-cursor-skills/tree/main/resources',
        '',
        'Examples:',
        '  prompt-exporter skill-install --list',
        '  prompt-exporter skill-install --registry awesome-cursor-skills --list',
        '  prompt-exporter skill-install writing-commit-messages creating-pr',
        '  prompt-exporter skill-install --registry awesome-cursor-skills writing-commit-messages --force',
        '',
        'Manage registries: prompt-exporter skill-registry --help',
      ].join('\n')
    )
    .action(async (skills: string[], options) => {
      await skillInstallCommand({
        registry: options.registry,
        destination: options.destination,
        force: options.force,
        list: options.list,
        all: options.all,
        descriptions: options.descriptions,
        json: options.json,
        skills,
      });
    });

  const skillRegistry = program
    .command('skill-registry')
    .description(
      'Manage skills registries (GitHub / GitLab / Codeberg catalogs of SKILL.md trees)'
    );

  skillRegistry
    .command('list')
    .description('List built-in and user skills registries')
    .option('--json', 'Output as JSON', false)
    .action(async (options) => {
      await skillRegistryListCommand({ json: options.json });
    });

  skillRegistry
    .command('add')
    .description('Add a user skills registry')
    .argument('<id>', 'Registry id (e.g. my-team-skills)')
    .argument(
      '<source>',
      'owner/repo or https://github.com|gitlab.com|codeberg.org/…[/tree/…]'
    )
    .option(
      '--host <host>',
      'Forge: github | gitlab | codeberg (default: inferred from URL, else github)'
    )
    .option(
      '--path <dir>',
      'Directory of skill folders in the repo (default: skills, or path from URL)'
    )
    .option('--ref <ref>', 'Git branch or tag (default: main, or from URL)')
    .option(
      '--nested',
      'Discover skills one level deeper (category/skill layouts)',
      false
    )
    .option('--label <label>', 'Display name')
    .option('--description <text>', 'Short description')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  prompt-exporter skill-registry add acs spencerpauly/awesome-cursor-skills --path resources',
        '  prompt-exporter skill-registry add acs https://github.com/spencerpauly/awesome-cursor-skills/tree/main/resources',
        '  prompt-exporter skill-registry add gl https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills --host gitlab',
        '  prompt-exporter skill-registry add mp mattpocock/skills --nested',
      ].join('\n')
    )
    .action(async (id: string, source: string, options) => {
      await skillRegistryAddCommand({
        id,
        source,
        path: options.path,
        ref: options.ref,
        host: options.host,
        nested: options.nested,
        label: options.label,
        description: options.description,
      });
    });

  skillRegistry
    .command('remove')
    .description('Remove a user skills registry')
    .argument('<id>', 'Registry id')
    .action(async (id: string) => {
      await skillRegistryRemoveCommand(id);
    });

  return program;
}
