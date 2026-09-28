# Quick start

## ChatGPT

```bash
prompt-exporter chromium start
# Log in at chatgpt.com in that window if needed
prompt-exporter sync --source chatgpt
prompt-exporter list --source chatgpt
```

Output lands under `~/.prompt-exporter/chatgpt/conversations/`.

## Perplexity

```bash
prompt-exporter chromium start --url https://www.perplexity.ai/
# Log in; Library threads should be visible
prompt-exporter sync --source perplexity
```

## Lumo (Proton)

```bash
prompt-exporter chromium start --url https://lumo.proton.me/
# Log in; wait until chats appear in the sidebar
prompt-exporter sync --source lumo
```

## Cursor rules and skills

From a project root:

```bash
prompt-exporter rule-install
prompt-exporter skill-install --list
prompt-exporter skill-install writing-commit-messages creating-pr
```

## Useful follow-ups

```bash
prompt-exporter sync --download-files          # also fetch attachments/images
prompt-exporter sync --no-incremental          # force full re-download
prompt-exporter sync --concurrency 6           # more parallel CDP tabs
prompt-exporter sources                        # list registered sources
```

## Next steps

- Source-specific guides: [ChatGPT](./guides/chatgpt.md), [Lumo](./guides/lumo.md), [Perplexity](./guides/perplexity.md)
- [Data layout](./concepts/data-layout.md)
- [Command overview](./commands/README.md)
