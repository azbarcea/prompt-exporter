# Chromium and CDP

Most sources need a **logged-in Chromium** with the Chrome DevTools Protocol (CDP) enabled. prompt-exporter attaches to that browser instead of scraping the page HTML.

## Why CDP?

Vendor sites often sit behind Cloudflare or similar. A bare Node `Authorization: Bearer …` request is frequently blocked. CDP runs real in-page `fetch` (or reads in-app state) with your cookies and session.

## Start or reuse Chromium

```bash
prompt-exporter chromium start
prompt-exporter chromium start --url https://www.perplexity.ai/
prompt-exporter chromium start --port 9222
```

If Chromium is already listening with CDP on the chosen port, it is **reused**. Otherwise the CLI starts Chromium (system profile by default).

### Useful options

| Option | Meaning |
|--------|---------|
| `--port <PORT>` | CDP port (default `9222`; also see `PROMPT_EXPORTER_CDP_PORT`) |
| `--url <url>` | Initial page (default `https://chatgpt.com/`) |
| `--isolated` | Empty profile under `~/.prompt-exporter/chromium` |
| `--user-data-dir <dir>` | Custom Chromium profile directory |
| `--headless` | Headless mode (login UX may be harder) |
| `--force` | Start even if something already answers on the port |
| `--print` | Print resolved browser binary and args |

## Browser binary

Resolution order typically uses `PROMPT_EXPORTER_BROWSER` when set, otherwise a discovered Chromium/Chrome on the system. See [Environment variables](./environment.md).

## Typical flow

1. `prompt-exporter chromium start` (or with `--url` for the source)
2. Complete login in the browser window if needed
3. `prompt-exporter sync --source …`

Full command reference: [`chromium`](../commands/chromium.md).
