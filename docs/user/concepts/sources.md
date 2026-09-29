# Sources

A **source** is a registered AI product that prompt-exporter can sync from. Each source has an id used with `-s` / `--source`.

## List sources

```bash
prompt-exporter sources
prompt-exporter sources --json
```

## Implemented sources

| Id | Product | Auth / transport | Notes |
|----|---------|------------------|-------|
| `chatgpt` | ChatGPT | Chromium CDP (optional Bearer fallback) | Default source; supports projects |
| `lumo` | Proton Lumo | Chromium CDP → in-app Redux | Server payloads are encrypted; sync reads decrypted client state |
| `perplexity` | Perplexity | Chromium CDP cookies → internal REST | No official public history API |
| `copilot` | Microsoft 365 Copilot Chat | Chromium CDP → Substrate (`GetChats` / `GetConversation`) | Personal export via logged-in SPA; not Graph enterprise API |

## Planned sources

`claude`, `gemini`, `deepseek`, `grok`, `kimi`.

## Per-source data directory

By default each source writes under:

```text
~/.prompt-exporter/{source}/
```

Override with `-o` / `--output` or `PROMPT_EXPORTER_DATA` (parent of all source dirs). See [Data layout](./data-layout.md).

## Guides

- [ChatGPT](../guides/chatgpt.md)
- [Lumo](../guides/lumo.md)
- [Perplexity](../guides/perplexity.md)
- [Microsoft 365 Copilot](../guides/copilot.md)
