import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts'],
  // CJS CLI binary: bundling CJS deps (commander/ora/…) into ESM hits
  // "Dynamic require of … is not supported".
  format: ['cjs'],
  platform: 'node',
  target: 'node24',
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  treeshake: true,
  shims: true,
  // Single self-contained CLI — no runtime node_modules required.
  // Shebang comes from src/index.ts (do not also set banner — double #! breaks the bundle).
  noExternal: [/.*/],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
});
