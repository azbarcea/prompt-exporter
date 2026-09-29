import chalk from 'chalk';
import ora from 'ora';
import { CopilotClient } from '../../sources/copilot/api/client.js';
import type { CopilotConversationDetail } from '../../sources/copilot/api/types.js';
import { convertDirectory } from '../../services/markdown-service.js';
import { StorageService } from '../../services/storage-service.js';
import type { ConversationDetail } from '../../sources/chatgpt/api/types.js';
import { createProgressBar } from '../../utils/progress.js';

export interface CopilotBackupCommandOptions {
  output: string;
  incremental: boolean;
  verbose: boolean;
  cdpPort?: number;
  delay?: number;
}

function asConversationDetail(
  detail: CopilotConversationDetail
): ConversationDetail {
  return detail as unknown as ConversationDetail;
}

export async function copilotBackupCommand(
  options: CopilotBackupCommandOptions
): Promise<void> {
  const delay = Math.max(100, options.delay ?? 400);
  const spinner = ora(
    'Connecting to M365 Copilot Chat via Chromium CDP…'
  ).start();

  let client: CopilotClient | undefined;
  try {
    client = await CopilotClient.connect({
      cdpPort: options.cdpPort,
      delayMs: delay,
      verbose: options.verbose,
    });
    spinner.succeed(
      chalk.green('Authenticated (M365 Copilot Substrate + CDP)')
    );

    console.log();
    console.log(chalk.bold('Backup settings:'));
    console.log(`  Output: ${options.output}`);
    console.log(`  Delay/gap: ${delay}ms`);
    console.log(
      '  Transport: substrate.office.com/m365Copilot via CDP (logged-in m365.cloud.microsoft/chat)'
    );
    console.log(`  Incremental: ${options.incremental}`);
    console.log();

    const storage = new StorageService(options.output);
    await storage.initialize();

    const listBarRef: {
      bar: ReturnType<typeof createProgressBar> | null;
    } = { bar: null };
    const conversations = await client.listAllChats((fetched) => {
      if (!listBarRef.bar) {
        listBarRef.bar = createProgressBar(Math.max(fetched, 1), 'Listing    ');
      } else {
        listBarRef.bar.setTotal(Math.max(fetched, 1));
      }
      listBarRef.bar.update(fetched);
    });
    if (listBarRef.bar) {
      listBarRef.bar.setTotal(Math.max(conversations.length, 1));
      listBarRef.bar.update(conversations.length);
      listBarRef.bar.stop();
      console.log();
    } else if (conversations.length === 0) {
      console.log(chalk.dim('  No chats found.'));
      console.log();
    }

    await storage.appendLog(
      `Copilot Substrate export: ${conversations.length} chats listed`
    );
    await storage.saveIndex(
      conversations as unknown as Parameters<StorageService['saveIndex']>[0]
    );

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ conversationId: string; error: string }> = [];

    const toFetch: typeof conversations = [];
    for (const item of conversations) {
      if (options.incremental) {
        const existing = await storage.getExistingConversationUpdateTime(
          item.id
        );
        if (existing !== null && existing >= item.update_time) {
          skipped++;
          continue;
        }
      }
      toFetch.push(item);
    }

    let dlBar: ReturnType<typeof createProgressBar> | null = null;
    if (toFetch.length) {
      dlBar = createProgressBar(toFetch.length, 'Downloading');
    }

    let completed = 0;
    for (const item of toFetch) {
      try {
        const detail = await client.getConversationDetail(item);
        await storage.saveConversation(
          detail.id,
          asConversationDetail(detail)
        );
        downloaded++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ conversationId: item.id, error: msg });
        if (options.verbose) console.error(chalk.red(`  ✗ ${msg}`));
      } finally {
        completed++;
        dlBar?.update(completed);
      }
    }
    dlBar?.stop();
    if (toFetch.length) console.log();

    await storage.saveMetadata({
      timestamp: new Date().toISOString(),
      totalConversations: conversations.length,
      successfulDownloads: downloaded,
      failedDownloads: failed,
      errors,
    });

    console.log(chalk.bold('Copilot backup summary'));
    console.log(`  Output:      ${options.output}`);
    console.log(`  Listed:      ${conversations.length}`);
    console.log(`  Downloaded:  ${downloaded}`);
    console.log(`  Skipped:     ${skipped}`);
    console.log(`  Failed:      ${failed}`);

    const mdSpinner = ora('Writing Markdown…').start();
    const md = await convertDirectory(options.output);
    if (md.converted === 0 && md.errors > 0) {
      mdSpinner.fail(
        chalk.red(`Markdown: 0 written, ${md.errors} errors`)
      );
    } else {
      mdSpinner.succeed(
        chalk.green(`Markdown: ${md.converted} written, ${md.errors} errors`)
      );
    }
  } catch (error) {
    spinner.fail(chalk.red('Copilot sync failed'));
    throw error;
  } finally {
    await client?.close();
  }
}

export async function copilotListCommand(options: {
  verbose?: boolean;
  json?: boolean;
  cdpPort?: number;
}): Promise<void> {
  const client = await CopilotClient.connect({
    cdpPort: options.cdpPort,
    verbose: options.verbose,
  });
  try {
    const conversations = await client.listAllChats();
    if (options.json) {
      console.log(JSON.stringify(conversations, null, 2));
      return;
    }
    console.log();
    console.log(
      chalk.bold(`M365 Copilot chats (${conversations.length})`)
    );
    for (const c of conversations) {
      const when = c.update_time
        ? new Date(c.update_time * 1000).toISOString().slice(0, 10)
        : '????-??-??';
      console.log(`  ${when}  ${c.title}  ${chalk.dim(c.id)}`);
    }
  } finally {
    await client.close();
  }
}
