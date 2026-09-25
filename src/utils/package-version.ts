import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read package.json version from install layout (dist/..) or dev layout (src/utils/../..).
 */
export function getPackageVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'package.json'), // dist/utils → package root
    path.join(here, '..', '..', 'package.json'), // src/utils → package root
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const ver = (JSON.parse(raw) as { version?: string }).version;
      if (ver) return ver;
    } catch {
      // try next
    }
  }
  return '0.0.0';
}
