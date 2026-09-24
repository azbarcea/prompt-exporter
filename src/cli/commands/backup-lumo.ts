import chalk from 'chalk';
import ora from 'ora';
import { exportLumoViaCdp } from '../../sources/lumo/api/cdp-export.js';
import type { LumoConversationDetail } from '../../sources/lumo/api/types.js';
import { convertDirectory } from '../../services/markdown-service.js';
import { StorageService } from '../../services/storage-service.js';
import type { ConversationDetail } from '../../sources/chatgpt/api/types.js';

export interface LumoBackupCommandOptions {
  output: string;
  incremental: boolean;
  verbose: boolean;
  cdpPort?: number;
}

function asConversationDetail(detail: LumoConversationDetail): ConversationDetail {
  return detail as unknown as ConversationDetail;
}

export async function lumoBackupCommand(
  options: LumoBackupCommandOptions
): Promise<void> {
  const spinner = ora('Connecting to Lumo via Chromium CDP…').start();
  try {
    const bundle = await exportLumoViaCdp({
      cdpPort: options.cdpPort,
      verbose: options.verbose,
    });
    spinner.succeed(
      chalk.green(
        `Lumo export: ${bundle.conversations.length} conversation(s) from Redux`
      )
    );
    if (bundle.warnings.length && options.verbose) {
      for (const w of bundle.warnings) {
        console.log(chalk.yellow(`  ⚠ ${w}`));
      }
    }

    const storage = new StorageService(options.output);
    await storage.initialize();
    await storage.appendLog(
      `Lumo CDP export: ${bundle.conversations.length} conversations`
    );
    await storage.saveIndex(
      bundle.conversations as unknown as Parameters<StorageService['saveIndex']>[0]
    );

    let downloaded = 0;
    let skipped = 0;
    for (const detail of bundle.details) {
      if (options.incremental) {
        const existing = await storage.getExistingConversationUpdateTime(detail.id);
        if (existing !== null && existing >= detail.update_time) {
          skipped++;
          continue;
        }
      }
      await storage.saveConversation(detail.id, asConversationDetail(detail));
      downloaded++;
    }

    await storage.saveMetadata({
      timestamp: new Date().toISOString(),
      totalConversations: bundle.conversations.length,
      successfulDownloads: downloaded,
      failedDownloads: 0,
      errors: [],
    });

    console.log();
    console.log(chalk.bold('Lumo backup summary'));
    console.log(`  Output:      ${options.output}`);
    console.log(`  Listed:      ${bundle.conversations.length}`);
    console.log(`  Downloaded:  ${downloaded}`);
    console.log(`  Skipped:     ${skipped}`);
    if (bundle.warnings.length) {
      console.log(`  Warnings:    ${bundle.warnings.length}`);
    }

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
    spinner.fail(chalk.red('Lumo sync failed'));
    throw error;
  }
}

export async function lumoListCommand(options: {
  verbose?: boolean;
  json?: boolean;
  cdpPort?: number;
}): Promise<void> {
  const bundle = await exportLumoViaCdp({
    cdpPort: options.cdpPort,
    verbose: options.verbose,
  });
  if (options.json) {
    console.log(JSON.stringify(bundle.conversations, null, 2));
    return;
  }
  console.log();
  console.log(chalk.bold(`Lumo conversations (${bundle.conversations.length})`));
  for (const c of bundle.conversations) {
    const when = c.update_time
      ? new Date(c.update_time * 1000).toISOString().slice(0, 10)
      : '????-??-??';
    console.log(`  ${when}  ${c.title}  ${chalk.dim(c.id)}`);
  }
  if (bundle.warnings.length && options.verbose) {
    console.log();
    for (const w of bundle.warnings) console.log(chalk.yellow(w));
  }
}
