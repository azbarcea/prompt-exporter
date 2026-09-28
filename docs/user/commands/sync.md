# `sync` / `backup`

Download conversations for a source to local JSON + Markdown.

`backup` is an alias for `sync` (same options).

## Usage

```bash
prompt-exporter sync
prompt-exporter sync --source chatgpt
prompt-exporter sync --source lumo
prompt-exporter sync --source perplexity
prompt-exporter sync --download-files
prompt-exporter sync --no-incremental
prompt-exporter sync --concurrency 6 --delay 200
prompt-exporter sync --project <name-or-id>
prompt-exporter backup --source chatgpt
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --source <id>` | `chatgpt` | Prompt source |
| `-t, --token <token>` | — | Optional Bearer fallback; not needed with CDP |
| `--port <PORT>` | auto | Preferred Chromium CDP port |
| `-o, --output <dir>` | `~/.prompt-exporter/{source}` | Source output directory |
| `--concurrency <n>` | `3` (max `6`) | Parallel downloads / CDP tabs |
| `--delay <ms>` | `200` | Min gap between starting requests |
| `--no-incremental` | off | Re-download all (default: skip unchanged) |
| `--download-files` | off | Download file attachments and images |
| `--project <name-or-id>` | — | Only backup conversations from a project |
| `-v, --verbose` | off | Verbose logging (throttle stats, etc.) |

## Behavior

- Incremental by default: skips conversations whose remote `update_time` matches local metadata.
- Writes Markdown under `conversations/` and raw JSON under `conversations/json/`.
- Requires a logged-in CDP Chromium for the usual sources; see [Chromium and CDP](../concepts/chromium-cdp.md).

## See also

- [Quick start](../quick-start.md)
- [ChatGPT](../guides/chatgpt.md) · [Lumo](../guides/lumo.md) · [Perplexity](../guides/perplexity.md)
- [Data layout](../concepts/data-layout.md)
