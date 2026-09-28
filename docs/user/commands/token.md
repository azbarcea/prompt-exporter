# `token`

Get an accessToken from the CDP Chromium session (primarily for **chatgpt**).

Normally you do **not** need this for sync — CDP in-page requests are preferred. Use `token` for debugging or as a Bearer fallback.

## Usage

```bash
prompt-exporter token
prompt-exporter token --show
prompt-exporter token --port 9222
prompt-exporter token --no-wait
```

## Options

| Option | Description |
|--------|-------------|
| `--port <PORT>` | CDP port of an already-running Chromium (default `9222`) |
| `--no-wait` | Exit immediately if not logged in (do not wait for interactive login) |
| `--timeout <ms>` | Login wait timeout (default `180000`) |
| `--print` | Print resolved browser path |
| `--show` | Print full `export PROMPT_EXPORTER_CHATGPT_TOKEN=…` line |
| `-s, --source <id>` | Source (default `chatgpt`) |

## Notes

- Saves under `~/.prompt-exporter/sources/chatgpt/token` when successful.
- Bare Bearer calls from Node are often blocked by Cloudflare; keep using CDP for sync.
