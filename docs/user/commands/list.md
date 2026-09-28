# `list`

List conversations from a source without downloading them.

## Usage

```bash
prompt-exporter list
prompt-exporter list --source chatgpt
prompt-exporter list --source lumo
prompt-exporter list --source perplexity
prompt-exporter list --json
prompt-exporter list --project <name-or-id>
```

## Options

| Option | Description |
|--------|-------------|
| `-s, --source <id>` | Prompt source (default `chatgpt`) |
| `-t, --token <token>` | Optional Bearer fallback |
| `--port <PORT>` | Preferred Chromium CDP port |
| `--delay <ms>` | Delay between requests (default `500`) |
| `--project <name-or-id>` | Only list a project’s conversations |
| `-v, --verbose` | Verbose logging |
| `--json` | Output as JSON |

## See also

- [`sync`](./sync.md)
- [`projects`](./projects.md)
