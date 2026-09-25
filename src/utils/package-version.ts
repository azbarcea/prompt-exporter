import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __PACKAGE_VERSION__: string | undefined;

/**
 * Prefer build-time injected version (bundled CLI); else read nearby package.json.
 */
export function getPackageVersion(): string {
  if (typeof __PACKAGE_VERSION__ === 'string' && __PACKAGE_VERSION__.length > 0) {
    return __PACKAGE_VERSION__;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'package.json'), // dist/ → package root
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
