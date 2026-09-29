# `chromium`

Manage Chromium with remote debugging (CDP).

## `chromium start`

Start Chromium with remote debugging, or reuse an existing CDP instance on the port.

```bash
prompt-exporter chromium start
prompt-exporter chromium start --port 9222
prompt-exporter chromium start --url https://lumo.proton.me/
prompt-exporter chromium start --url https://www.perplexity.ai/
prompt-exporter chromium start --url https://m365.cloud.microsoft/chat
prompt-exporter chromium start --isolated
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--port <PORT>` | `9222` | CDP port |
| `--isolated` | off | Separate empty profile under `~/.prompt-exporter/chromium` |
| `--user-data-dir <dir>` | system profile | Chromium user-data-dir |
| `--headless` | off | Headless mode |
| `--url <url>` | `https://chatgpt.com/` | Initial URL |
| `--force` | off | Start even if CDP already answers on the port |
| `--print` | off | Print resolved browser path and args |

### Behavior

- If Chromium is already running with CDP on this port, it is **reused**.
- Otherwise starts Chromium with your system profile (unless `--isolated` / `--user-data-dir`).

## See also

- [Chromium and CDP](../concepts/chromium-cdp.md)
- [Environment variables](../concepts/environment.md)
