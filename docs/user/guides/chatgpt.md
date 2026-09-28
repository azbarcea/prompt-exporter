# Sync ChatGPT

ChatGPT is the default source (`-s chatgpt`).

## Prerequisites

1. Chromium with CDP: `prompt-exporter chromium start`
2. Logged in at [chatgpt.com](https://chatgpt.com/) in that browser

## Sync

```bash
prompt-exporter sync
prompt-exporter sync --source chatgpt
prompt-exporter sync --concurrency 6
prompt-exporter sync --download-files
prompt-exporter sync --no-incremental
prompt-exporter sync --project <name-or-id>
```

Incremental sync is the default: unchanged conversations (same `update_time`) are skipped.

## List without downloading

```bash
prompt-exporter list --source chatgpt
prompt-exporter list --json
prompt-exporter projects --source chatgpt
```

## Optional token

Normally CDP is enough. For debugging or fallback:

```bash
prompt-exporter token --show
# or export PROMPT_EXPORTER_CHATGPT_TOKEN=…
```

Node Bearer alone is often blocked by Cloudflare; prefer the CDP session.

## Output

`~/.prompt-exporter/chatgpt/conversations/` — see [Data layout](../concepts/data-layout.md).

## Commands

- [`sync`](../commands/sync.md)
- [`list`](../commands/list.md)
- [`projects`](../commands/projects.md)
- [`token`](../commands/token.md)
