import chalk from 'chalk';
import ora from 'ora';
import { createChatGptClient } from '../../sources/chatgpt/api/create-client.js';
import { BackupService } from '../../services/backup-service.js';
import { StorageService } from '../../services/storage-service.js';
import { getDefaultDataDir } from '../../utils/paths.js';

export interface ListOptions {
  token?: string;
  delay: number;
  verbose: boolean;
  json: boolean;
  project?: string;
  cdpPort?: number;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const { token, delay, verbose, json, project, cdpPort } = options;

  const spinner = ora('Connecting...').start();
  const { client } = await createChatGptClient({ token, verbose, cdpPort });
  const storage = new StorageService(getDefaultDataDir());
  const service = new BackupService(client, storage);

  try {
    await client.initialize();

    let conversations;

    if (project) {
      spinner.text = 'Resolving project...';
      const { gizmoId, name } = await service.resolveProjectId(project);
      spinner.text = `Fetching conversations from project "${name}"...`;

      let lastReported = 0;
      conversations = await service.listProjectConversations(gizmoId, {
        delay,
        onListProgress: (fetched, total) => {
          if (fetched !== lastReported) {
            spinner.text = `Fetching conversations from "${name}"... ${fetched}`;
            lastReported = fetched;
          }
        },
      });

      spinner.succeed(`Found ${conversations.length} conversations in project "${name}"`);
    } else {
      spinner.text = 'Fetching conversations...';

      let lastReported = 0;
      conversations = await service.listConversations({
        delay,
        onListProgress: (fetched, total) => {
          if (fetched !== lastReported) {
            spinner.text = `Fetching conversations... ${fetched}/${total}`;
            lastReported = fetched;
          }
        },
      });

      spinner.succeed(`Found ${conversations.length} conversations`);
    }

    if (json) {
      console.log(JSON.stringify(conversations, null, 2));
    } else {
      console.log();
      for (const conv of conversations) {
        const title = conv.title ?? chalk.dim('(untitled)');
        const date = conv.update_time
          ? new Date(
              typeof conv.update_time === 'number'
                ? conv.update_time * 1000
                : conv.update_time
            ).toLocaleDateString()
          : 'unknown date';

        console.log(`${chalk.cyan(conv.id)} ${title} ${chalk.dim(`[${date}]`)}`);
      }
      console.log();
      console.log(chalk.green(`Total: ${conversations.length} conversations`));
    }
  } catch (error) {
    spinner.fail('Failed to list conversations');

    if (error instanceof Error) {
      if (error.name === 'AuthenticationError') {
        console.error(chalk.red(`\nAuthentication failed: ${error.message}`));
        console.error(
          chalk.yellow(
            '\nKeep Chromium CDP logged in to chatgpt.com, then retry:'
          )
        );
        console.error('  prompt-exporter chromium start');
        console.error('  prompt-exporter list');
      } else {
        console.error(chalk.red(`\nError: ${error.message}`));
      }
    }

    process.exit(1);
  } finally {
    await client.close();
  }
}
