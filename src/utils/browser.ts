import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

function chromiumCandidates(): string[] {
  return [
    process.env.PROMPT_EXPORTER_BROWSER,
    process.env.CHATGPT_EXPORTER_BROWSER,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ].filter((v): v is string => Boolean(v));
}

export async function resolveBrowser(): Promise<string> {
  for (const candidate of chromiumCandidates()) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    'Chromium not found. Install the chromium package (Arch: pacman -S chromium) ' +
      'or set PROMPT_EXPORTER_BROWSER to a Chromium-based browser path.'
  );
}
