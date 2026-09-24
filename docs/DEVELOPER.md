# prompt-exporter — Developer Guide

## Overview

TypeScript ESM CLI that:

1. Talks to a **source** (first: ChatGPT via Chromium CDP in-page `fetch`)
2. Writes JSON + Markdown under `~/.prompt-exporter/{source}/`
3. Registers sources in `src/sources/registry.ts`

## Layout

```text
src/
  cli/                     # commander entry + commands
  sources/
    types.ts               # Source interface
    registry.ts
    chatgpt/               # chatgpt source (api/, index.ts)
  services/                # storage, markdown, backup (source-agnostic)
  utils/                   # paths, credentials, cdp, browser
aur/                       # Arch PKGBUILD for prompt-exporter-git
```

## Develop

```bash
git clone https://github.com/azbarcea/prompt-exporter.git
cd prompt-exporter
npm install
npm run typecheck
npm test
npm run dev -- --help
npm run dev -- sync --source chatgpt -v
```

## Paths

| Helper | Default |
|--------|---------|
| `getConfigDir()` | `~/.prompt-exporter` |
| `getSourceDataDir('chatgpt')` | `~/.prompt-exporter/chatgpt` |
| `getSourceTokenPath('chatgpt')` | `~/.prompt-exporter/sources/chatgpt/token` |

Env: `PROMPT_EXPORTER_HOME`, `PROMPT_EXPORTER_DATA`, `PROMPT_EXPORTER_BROWSER`, `PROMPT_EXPORTER_CDP_PORT`.

## Adding a source

1. Implement `Source` in `src/sources/<id>/`
2. Register in `src/sources/registry.ts`
3. Wire `sync` / `list` in `src/cli/index.ts` for that id

## License

Apache-2.0 — `LICENSE` + `NOTICE`.
