# `projects`

List projects for a source (ChatGPT projects).

## Usage

```bash
prompt-exporter projects
prompt-exporter projects --source chatgpt
prompt-exporter projects --json
```

## Options

| Option | Description |
|--------|-------------|
| `-s, --source <id>` | Prompt source (default `chatgpt`) |
| `-t, --token <token>` | Optional Bearer fallback |
| `--port <PORT>` | Preferred Chromium CDP port |
| `-v, --verbose` | Verbose logging |
| `--json` | Output as JSON |

## Related sync

```bash
prompt-exporter sync --project <name-or-id>
prompt-exporter list --project <name-or-id>
```
