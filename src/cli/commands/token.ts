import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { resolveBrowser } from '../../utils/browser.js';
import { discoverCdpPort, isCdpRunning, getCdpEndpointInfo } from '../../utils/cdp.js';
import {
  APP_URL,
  SESSION_URL,
  ensureChatGptAppTab,
  prepareSessionTarget,
  waitForAccessToken,
} from '../../utils/cdp-session.js';
import { getTokenPath, saveToken } from '../../utils/credentials.js';
import { DEFAULT_CDP_PORT } from '../../utils/paths.js';

export interface TokenCommandOptions {
  print?: boolean;
  port?: number;
  wait?: boolean;
  timeoutMs?: number;
  /** Print full token to stdout (default: save quietly + show short preview) */
  show?: boolean;
}

async function persistAndAnnounce(token: string, show: boolean): Promise<void> {
  const file = await saveToken(token);
  console.log(chalk.green('Saved accessToken for sync.'));
  console.log(chalk.dim(`  ${file}`));
  console.log(chalk.dim(`  preview: ${token.slice(0, 16)}… (${token.length} chars)`));
  console.log('');
  if (show) {
    console.log(`  export PROMPT_EXPORTER_CHATGPT_TOKEN="${token}"`);
    console.log('');
  }
  console.log('You can sync right away (no manual export needed):');
  console.log(chalk.cyan('  prompt-exporter sync'));
}

function printManualSteps(): void {
  console.log('Steps:');
  console.log('  1. Ensure CDP Chromium shows https://chatgpt.com/api/auth/session JSON');
  console.log('  2. Re-run: prompt-exporter token');
  console.log('  3. prompt-exporter sync');
}

export async function tokenCommand(
  options: TokenCommandOptions = {}
): Promise<void> {
  let port = options.port ?? DEFAULT_CDP_PORT;
  const wait = options.wait ?? true;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const show = options.show ?? false;

  if (!(await isCdpRunning(port))) {
    const found = await discoverCdpPort(port);
    if (found !== null) {
      port = found;
    }
  }

  if (!(await isCdpRunning(port))) {
    console.log(
      chalk.yellow(
        `No CDP on port ${port}. Start one with: prompt-exporter chromium start`
      )
    );
    console.log(chalk.dim('Opening a separate Chromium window as fallback…'));
    console.log('');

    const browser = await resolveBrowser();
    console.log(`Open ${SESSION_URL}, then re-run prompt-exporter token`);
    console.log('');
    printManualSteps();
    if (options.print) console.log(`Browser: ${browser}`);

    const child = spawn(browser, ['--new-window', SESSION_URL], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  const info = await getCdpEndpointInfo(port);
  console.log(chalk.green(`Using existing Chromium CDP on port ${port}.`));
  if (info?.Browser) {
    console.log(chalk.dim(`  Browser: ${info.Browser}`));
  }
  console.log(chalk.dim(`  Token file: ${getTokenPath()}`));
  console.log('');

  try {
    const { target, reused, probe } = await prepareSessionTarget(port);

    console.log(
      chalk.dim(
        `${reused ? 'Reused' : 'Opened'} tab: ${target.title || target.id}`
      )
    );
    console.log(chalk.dim(`  ${target.url || SESSION_URL}`));
    console.log('');

    if (probe.loggedIn && probe.accessToken) {
      await persistAndAnnounce(probe.accessToken, show);
      return;
    }

    if (probe.anonymousBannerOnly || !probe.loggedIn) {
      console.log(
        chalk.yellow(
          'No accessToken in the session tab yet (anonymous / not logged in).'
        )
      );
      if (probe.keys.length) {
        console.log(chalk.dim(`  session keys: ${probe.keys.join(', ')}`));
      }
      if (probe.error) {
        console.log(chalk.dim(`  ${probe.error}`));
      }
      console.log('');

      const appTab = await ensureChatGptAppTab(port);
      console.log(chalk.cyan(`Focused ChatGPT for login: ${APP_URL}`));
      console.log(chalk.dim(`  Tab: ${appTab.url || APP_URL}`));
      console.log('');

      if (!wait) {
        printManualSteps();
        return;
      }

      console.log(
        chalk.bold(
          `Waiting up to ${Math.round(timeoutMs / 1000)}s for login, then re-reading session…`
        )
      );
      console.log(chalk.dim('Press Ctrl+C to cancel.'));
      console.log('');

      const finalProbe = await waitForAccessToken(port, {
        timeoutMs,
        intervalMs: 2500,
        onTick: (p) => {
          if (p.loggedIn) return;
          process.stdout.write(
            chalk.dim(
              `  waiting… (${p.anonymousBannerOnly ? 'banner-only' : p.keys.join(',') || 'no token'})\r`
            )
          );
        },
      });
      process.stdout.write('\n');

      if (finalProbe.loggedIn && finalProbe.accessToken) {
        await persistAndAnnounce(finalProbe.accessToken, show);
        return;
      }

      console.log(chalk.red('Timed out — accessToken not found.'));
      printManualSteps();
      process.exitCode = 1;
      return;
    }

    console.log(chalk.yellow('Could not read accessToken from the session page.'));
    if (probe.error) console.log(chalk.dim(`  ${probe.error}`));
    printManualSteps();
    process.exitCode = 1;
  } catch (error) {
    console.error(
      chalk.red(
        `CDP session failed: ${error instanceof Error ? error.message : error}`
      )
    );
    printManualSteps();
    process.exitCode = 1;
  }
}

/** Resolve a token from CDP and persist it (used by sync). */
export async function obtainTokenViaCdp(
  port: number = DEFAULT_CDP_PORT
): Promise<string | null> {
  let usePort = port;
  if (!(await isCdpRunning(usePort))) {
    const found = await discoverCdpPort(usePort);
    if (found === null) return null;
    usePort = found;
  }
  const { probe } = await prepareSessionTarget(usePort);
  if (probe.loggedIn && probe.accessToken) {
    await saveToken(probe.accessToken);
    return probe.accessToken;
  }
  return null;
}
