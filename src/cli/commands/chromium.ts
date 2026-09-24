import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { resolveBrowser } from '../../utils/browser.js';
import {
  activateCdpTarget,
  discoverCdpPort,
  getCdpEndpointInfo,
  isChatGptUrl,
  listCdpTargets,
  openCdpTab,
  type CdpEndpointInfo,
} from '../../utils/cdp.js';
import {
  DEFAULT_CDP_PORT,
  resolveChromiumUserDataDir,
} from '../../utils/paths.js';

export interface ChromiumStartOptions {
  port: number;
  headless?: boolean;
  url?: string;
  print?: boolean;
  /** Force spawning a new Chromium even if CDP is already up */
  force?: boolean;
  /** Use ~/.prompt-exporter/chromium instead of the system profile */
  isolated?: boolean;
  /** Explicit Chromium --user-data-dir */
  userDataDir?: string;
}

function printNextSteps(): void {
  console.log('Then run:');
  console.log(chalk.cyan('  prompt-exporter token'));
  console.log('to read accessToken from this browser session.');
  console.log('');
  console.log('Then sync conversations:');
  console.log(chalk.cyan('  prompt-exporter sync'));
  console.log('');
}

async function isProfileLocked(userDataDir: string): Promise<boolean> {
  for (const name of ['SingletonLock', 'lockfile', 'SingletonSocket']) {
    try {
      await fs.access(path.join(userDataDir, name));
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

/**
 * Attach to an already-running Chromium with CDP: focus/open a tab, never spawn.
 */
export async function reuseExistingCdp(
  port: number,
  url: string,
  existing?: CdpEndpointInfo | null
): Promise<void> {
  const info = existing ?? (await getCdpEndpointInfo(port));
  if (!info) {
    throw new Error(`No CDP endpoint on port ${port}`);
  }

  console.log(chalk.green(`Reusing Chromium CDP on port ${port}.`));
  console.log(chalk.dim(`  CDP:  http://127.0.0.1:${port}`));
  if (info.Browser) {
    console.log(chalk.dim(`  Browser: ${info.Browser}`));
  }
  if (info.webSocketDebuggerUrl) {
    console.log(chalk.dim(`  WS: ${info.webSocketDebuggerUrl}`));
  }
  console.log('');

  const targets = await listCdpTargets(port);
  const pages = targets.filter((t) => t.type === 'page' || t.type === 'tab');

  const exact = pages.find((t) => t.url === url || t.url.startsWith(url + '?'));
  const chatgpt =
    exact ??
    (isChatGptUrl(url)
      ? pages.find((t) => isChatGptUrl(t.url))
      : undefined);

  if (chatgpt) {
    await activateCdpTarget(port, chatgpt.id);
    console.log(chalk.green(`Focused existing tab in that browser.`));
    console.log(chalk.dim(`  ${chatgpt.title || chatgpt.id}`));
    console.log(chalk.dim(`  ${chatgpt.url}`));
  } else {
    const created = await openCdpTab(port, url);
    console.log(chalk.green(`Opened a new tab in that browser (same session).`));
    console.log(chalk.dim(`  ${created.url || url}`));
  }

  console.log('');
  printNextSteps();
}

export async function chromiumStartCommand(
  options: ChromiumStartOptions
): Promise<void> {
  let port = options.port || DEFAULT_CDP_PORT;
  const url = options.url ?? 'https://chatgpt.com/';
  const userSetPort = options.port !== undefined && options.port !== DEFAULT_CDP_PORT;

  // Prefer an already-running CDP browser — never spawn another profile/window.
  let existing = await getCdpEndpointInfo(port);
  if (!existing && !userSetPort && !options.force) {
    const found = await discoverCdpPort(port);
    if (found !== null) {
      port = found;
      existing = await getCdpEndpointInfo(port);
    }
  }
  if (existing && !options.force) {
    await reuseExistingCdp(port, url, existing);
    return;
  }

  const browser = await resolveBrowser();
  const { dir: userDataDir, mode } = resolveChromiumUserDataDir({
    isolated: options.isolated,
    userDataDir: options.userDataDir,
    browserPath: browser,
  });

  await fs.mkdir(userDataDir, { recursive: true });

  if (await isProfileLocked(userDataDir)) {
    // Race: browser may have exposed CDP after our first probe, or on this profile.
    const again = await getCdpEndpointInfo(port);
    if (again && !options.force) {
      await reuseExistingCdp(port, url, again);
      return;
    }

    console.log(
      chalk.yellow('Chromium profile is already in use (browser running).')
    );
    console.log(chalk.dim(`  Profile: ${userDataDir}`));
    console.log('');
    console.log(
      chalk.yellow(
        `No CDP answered on port ${port}, so this running browser cannot be controlled.`
      )
    );
    console.log('');
    console.log('Either:');
    console.log(
      `  • Point at the port where CDP is listening:  prompt-exporter chromium start --port <PORT>`
    );
    console.log(
      '  • Or quit Chromium and start it with CDP:     prompt-exporter chromium start'
    );
    console.log('');
    process.exitCode = 1;
    return;
  }

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];

  if (options.headless) {
    args.push('--headless=new');
  }

  args.push(url);

  if (options.print) {
    console.log(chalk.dim(`Browser: ${browser}`));
    console.log(chalk.dim(`Args: ${args.join(' ')}`));
  }

  console.log(chalk.bold('Starting Chromium with remote debugging…'));
  console.log(chalk.dim(`  CDP:     http://127.0.0.1:${port}`));
  console.log(
    chalk.dim(
      `  Profile: ${userDataDir}` +
        (mode === 'system'
          ? ' (system — your normal login)'
          : mode === 'isolated'
            ? ' (isolated)'
            : ' (custom)')
    )
  );
  console.log('');
  printNextSteps();

  const child = spawn(browser, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  console.log(chalk.green(`Chromium started (pid ${child.pid ?? 'unknown'}).`));
}
