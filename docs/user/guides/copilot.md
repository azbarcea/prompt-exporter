# Sync Microsoft 365 Copilot

Exports **M365 Copilot Chat** threads from [m365.cloud.microsoft/chat](https://m365.cloud.microsoft/chat) using the same Substrate APIs as the web UI (`GetChats` / `GetConversation`), authenticated via a logged-in Chromium CDP session (MSAL token from the page).

This is **not** the Graph enterprise Copilot Activity Export API (which needs app-only admin permissions). No Azure AD app registration is required for personal export.

## Prerequisites

```bash
prompt-exporter chromium start --url https://m365.cloud.microsoft/chat
```

Sign in with your work/school account and wait until Copilot Chat loads.

## Sync and list

```bash
prompt-exporter sync --source copilot
prompt-exporter list --source copilot
prompt-exporter list --source copilot --json
```

Incremental by default (skips unchanged `update_time`).

Tune request gap if Substrate throttles:

```bash
prompt-exporter sync --source copilot --delay 800
```

## Notes

- Requires an M365 Copilot Chat session in the CDP browser (BizChat / webchat).
- Substrate returns at most ~500 recent chats (vendor limit).
- Data root: `~/.prompt-exporter/copilot/`
- Aliases: source id is `copilot` (not `m365`).

## Commands

- [`chromium`](../commands/chromium.md)
- [`sync`](../commands/sync.md)
- [`list`](../commands/list.md)
