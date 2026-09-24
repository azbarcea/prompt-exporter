import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ensureHomeLayout,
  getSourceTokenPath,
} from './paths.js';

/** Stored access token: ~/.prompt-exporter/sources/{source}/token */
export function getTokenPath(sourceId: string = 'chatgpt'): string {
  return getSourceTokenPath(sourceId);
}

export async function loadSavedToken(
  sourceId: string = 'chatgpt'
): Promise<string | null> {
  await ensureHomeLayout();
  try {
    const raw = await fs.readFile(getTokenPath(sourceId), 'utf-8');
    const token = raw.trim();
    return token.startsWith('eyJ') ? token : null;
  } catch {
    // Legacy flat ~/.prompt-exporter/token already migrated by ensureHomeLayout
    return null;
  }
}

export async function saveToken(
  token: string,
  sourceId: string = 'chatgpt'
): Promise<string> {
  if (!token.startsWith('eyJ')) {
    throw new Error(
      'Refusing to save a value that does not look like a JWT accessToken'
    );
  }
  await ensureHomeLayout();
  const file = getTokenPath(sourceId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${token}\n`, { encoding: 'utf-8', mode: 0o600 });
  await fs.chmod(file, 0o600).catch(() => undefined);
  return file;
}

export async function clearSavedToken(
  sourceId: string = 'chatgpt'
): Promise<void> {
  try {
    await fs.unlink(getTokenPath(sourceId));
  } catch {
    // ignore
  }
}
