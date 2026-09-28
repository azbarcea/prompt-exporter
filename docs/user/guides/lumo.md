# Sync Lumo

Lumo ([lumo.proton.me](https://lumo.proton.me/)) encrypts conversation payloads on the server. prompt-exporter syncs by reading the **decrypted** in-app Redux store over Chromium CDP after you log in.

## Prerequisites

```bash
prompt-exporter chromium start --url https://lumo.proton.me/
```

Log in and wait until chats appear in the sidebar.

## Sync and list

```bash
prompt-exporter sync --source lumo
prompt-exporter list --source lumo
```

Incremental by default (skips unchanged `update_time`).

## Notes

- There is no separate Lumo Bearer flow comparable to ChatGPT’s `token` command.
- Data root: `~/.prompt-exporter/lumo/`

## Commands

- [`chromium`](../commands/chromium.md)
- [`sync`](../commands/sync.md)
- [`list`](../commands/list.md)
