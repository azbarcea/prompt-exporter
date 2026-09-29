# Troubleshooting

## `prompt-exporter` not found / wrong binary

After switching from npm link to AUR (or the reverse):

```bash
type prompt-exporter
hash -r
type prompt-exporter
```

## Chromium / CDP

| Symptom | What to try |
|---------|-------------|
| Sync cannot authenticate | `prompt-exporter chromium start`, log in in that window, retry |
| Port in use | `--port 9223` or set `PROMPT_EXPORTER_CDP_PORT` |
| Wrong browser | `export PROMPT_EXPORTER_BROWSER=/path/to/chromium` |
| Want a clean profile | `chromium start --isolated` |

## Cloudflare / 403 on ChatGPT

Prefer CDP (in-page) over `-t` / `PROMPT_EXPORTER_CHATGPT_TOKEN`. Bare Node Bearer requests are often blocked.

## Lumo empty sync

Ensure you are logged in and chats are visible in the sidebar before `sync --source lumo`. Sync reads decrypted client state, not ciphertext from the server.

## Perplexity empty sync

Confirm Library threads are visible in the CDP browser at [perplexity.ai](https://www.perplexity.ai/).

## Copilot empty sync / auth errors

Confirm you are signed in at [m365.cloud.microsoft/chat](https://m365.cloud.microsoft/chat) in the CDP browser. Sync reads the page MSAL token and calls Substrate — refresh the tab if the token expired. Increase `--delay` if you hit throttling.

## Skills: rate limit / API errors

Current releases clone registries with **git** and scan disk. If you still see Contents API rate-limit messages, upgrade or ensure you are not forcing an old binary. For clone failures, check network, `git` on `PATH`, and public HTTPS access to the forge.

```bash
prompt-exporter skill-install --list --refresh
```

## Skills: agent mismatch (non-interactive)

```text
Registry "…" targets […], but destination is for cursor.
Re-run with --convert … or --as-is …
```

Pass `--convert` or `--as-is`, or run in a TTY to answer the prompt.

## Incremental sync skipped everything

Expected when nothing changed. Force a full pass:

```bash
prompt-exporter sync --no-incremental
```

## More help

```bash
prompt-exporter --help
prompt-exporter <command> --help
```
