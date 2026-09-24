import chalk from 'chalk';
import ora from 'ora';
import { createChatGptClient } from '../../sources/chatgpt/api/create-client.js';
import { BackupService } from '../../services/backup-service.js';
import { StorageService } from '../../services/storage-service.js';
import { getDefaultDataDir } from '../../utils/paths.js';

export interface ProjectsCommandOptions {
  token?: string;
  verbose: boolean;
  json: boolean;
  cdpPort?: number;
}

export async function projectsCommand(
  options: ProjectsCommandOptions
): Promise<void> {
  const { token, verbose, json, cdpPort } = options;

  const spinner = ora('Connecting...').start();
  const { client } = await createChatGptClient({ token, verbose, cdpPort });
  const storage = new StorageService(getDefaultDataDir());
  const service = new BackupService(client, storage);

  try {
    await client.initialize();
    spinner.text = 'Fetching projects...';

    const projects = await service.listProjects();
    spinner.succeed(`Found ${projects.length} projects`);

    if (json) {
      const output = projects.map((p) => ({
        id: p.gizmo.id,
        name: p.gizmo.display.name,
        num_interactions: p.gizmo.num_interactions,
        last_interacted_at: p.gizmo.last_interacted_at,
        is_archived: p.gizmo.is_archived,
      }));
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log();
      for (const project of projects) {
        const gizmo = project.gizmo;
        const name = gizmo.display.name;
        const id = gizmo.id;
        const lastInteracted = gizmo.last_interacted_at
          ? new Date(gizmo.last_interacted_at).toLocaleDateString()
          : 'never';

        console.log(
          `${chalk.cyan(id)} ${chalk.bold(name)} ${chalk.dim(`[last: ${lastInteracted}]`)}`
        );
      }
      console.log();
      console.log(chalk.green(`Total: ${projects.length} projects`));
    }
  } catch (error) {
    spinner.fail('Failed to list projects');

    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      if (error.name === 'AuthenticationError') {
        console.error(chalk.yellow('\nKeep Chromium CDP logged in, then retry:'));
        console.error('  prompt-exporter chromium start');
        console.error('  prompt-exporter projects');
      }
    }

    process.exit(1);
  } finally {
    await client.close();
  }
}
