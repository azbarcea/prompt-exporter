# Sync Perplexity

Perplexity does not offer an official public API for thread history. prompt-exporter calls Perplexity’s internal REST endpoints (`/rest/thread/list_ask_threads`, `/rest/thread/{uuid}`) from a logged-in Chromium tab (cookies / Cloudflare).

## Prerequisites

```bash
prompt-exporter chromium start --url https://www.perplexity.ai/
```

Log in so Library threads are visible.

## Sync and list

```bash
prompt-exporter sync --source perplexity
prompt-exporter list --source perplexity
```

Incremental by default.

## Notes

- CDP is transport and auth only; the tool uses the same internal REST the web app uses.
- Data root: `~/.prompt-exporter/perplexity/`

## Commands

- [`chromium`](../commands/chromium.md)
- [`sync`](../commands/sync.md)
- [`list`](../commands/list.md)
