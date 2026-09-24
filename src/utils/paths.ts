import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Config / state root: ~/.prompt-exporter */
export function getConfigDir(): string {
  return (
    process.env.PROMPT_EXPORTER_HOME?.trim() ||
    path.join(os.homedir(), '.prompt-exporter')
  );
}

/**
 * Parent of per-source data dirs. Default: ~/.prompt-exporter
 * Override with PROMPT_EXPORTER_DATA (legacy CHATGPT_EXPORTER_DATA accepted).
 */
export function getDataParentDir(): string {
  return (
    process.env.PROMPT_EXPORTER_DATA?.trim() ||
    process.env.CHATGPT_EXPORTER_DATA?.trim() ||
    getConfigDir()
  );
}

/** Per-source sync root: ~/.prompt-exporter/{source} */
export function getSourceDataDir(sourceId: string): string {
  return path.join(getDataParentDir(), sourceId);
}

/**
 * @deprecated Prefer getSourceDataDir(sourceId). Defaults to chatgpt source root.
 */
export function getDefaultDataDir(): string {
  return getSourceDataDir('chatgpt');
}

export function getSourceTokenPath(sourceId: string): string {
  return path.join(getConfigDir(), 'sources', sourceId, 'token');
}

export function getIsolatedChromiumProfileDir(): string {
  return path.join(getConfigDir(), 'chromium');
}

/** @deprecated Use getIsolatedChromiumProfileDir() */
export function getChromiumProfileDir(): string {
  return getIsolatedChromiumProfileDir();
}

export function getSystemChromiumUserDataDir(browserPath?: string): string {
  const home = os.homedir();
  const binary = (
    browserPath ||
    process.env.PROMPT_EXPORTER_BROWSER ||
    process.env.CHATGPT_EXPORTER_BROWSER ||
    ''
  ).toLowerCase();

  if (process.platform === 'darwin') {
    if (binary.includes('chrome')) {
      return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
    }
    return path.join(home, 'Library', 'Application Support', 'Chromium');
  }

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    if (binary.includes('chrome')) {
      return path.join(local, 'Google', 'Chrome', 'User Data');
    }
    return path.join(local, 'Chromium', 'User Data');
  }

  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  if (binary.includes('google-chrome') || /\/chrome$/.test(binary)) {
    return path.join(config, 'google-chrome');
  }
  return path.join(config, 'chromium');
}

export type ChromiumProfileMode = 'system' | 'isolated' | 'custom';

export function resolveChromiumUserDataDir(options: {
  isolated?: boolean;
  userDataDir?: string;
  browserPath?: string;
}): { dir: string; mode: ChromiumProfileMode } {
  const custom =
    options.userDataDir?.trim() ||
    process.env.PROMPT_EXPORTER_USER_DATA_DIR?.trim() ||
    process.env.CHATGPT_EXPORTER_USER_DATA_DIR?.trim();
  if (custom) {
    return { dir: custom, mode: 'custom' };
  }
  if (options.isolated) {
    return { dir: getIsolatedChromiumProfileDir(), mode: 'isolated' };
  }
  return {
    dir: getSystemChromiumUserDataDir(options.browserPath),
    mode: 'system',
  };
}

export const DEFAULT_CDP_PORT = 9222;
export const DEFAULT_SOURCE_ID = 'chatgpt';

/**
 * One-time layout migration from ~/.chatgpt-exporter and flat token file.
 */
export async function ensureHomeLayout(): Promise<void> {
  const home = getConfigDir();
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(path.join(home, 'sources'), { recursive: true });

  const legacyHome = path.join(os.homedir(), '.chatgpt-exporter');
  if (home !== legacyHome) {
    try {
      await fs.access(legacyHome);
      const entries = await fs.readdir(legacyHome, { withFileTypes: true });
      for (const entry of entries) {
        const from = path.join(legacyHome, entry.name);
        if (entry.name === 'token') {
          const destDir = path.join(home, 'sources', 'chatgpt');
          await fs.mkdir(destDir, { recursive: true });
          const dest = path.join(destDir, 'token');
          try {
            await fs.access(dest);
          } catch {
            await fs.rename(from, dest).catch(async () => {
              await fs.copyFile(from, dest);
            });
          }
          continue;
        }
        if (entry.name === 'data') {
          const dest = path.join(home, 'chatgpt');
          try {
            await fs.access(dest);
          } catch {
            await fs.rename(from, dest).catch(() => undefined);
          }
          continue;
        }
        if (entry.name === 'chromium' || entry.name === 'chatgpt') {
          const dest = path.join(home, entry.name);
          try {
            await fs.access(dest);
          } catch {
            await fs.rename(from, dest).catch(() => undefined);
          }
        }
      }
    } catch {
      // no legacy home
    }
  }

  // Flat token → sources/chatgpt/token (within current home only)
  const flatToken = path.join(home, 'token');
  const nestedToken = getSourceTokenPath('chatgpt');
  try {
    await fs.access(flatToken);
    await fs.mkdir(path.dirname(nestedToken), { recursive: true });
    try {
      await fs.access(nestedToken);
    } catch {
      await fs.rename(flatToken, nestedToken).catch(async () => {
        await fs.copyFile(flatToken, nestedToken);
      });
    }
  } catch {
    // no flat token
  }
}
