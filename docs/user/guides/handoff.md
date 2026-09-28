# Handoff to another AI

Use the local Markdown archive as context in Cursor, Claude, Codex, or a local model.

## Workflow

```bash
prompt-exporter sync --source chatgpt
# Open ~/.prompt-exporter/chatgpt/conversations/<date>.<title>.md
```

Then either:

1. Attach or paste the `.md` into a new chat, or
2. Run a compact / summarize skill on the file and start a fresh session with the brief

Sketch:

```bash
prompt-exporter sync --source chatgpt
# In Cursor: /compact (or your summarize skill) on that file
# Start a new chat with the compact brief as context
```

## Why Markdown + JSON

- **Markdown** — readable, easy to attach, greppable
- **JSON** — full fidelity under `conversations/json/` if you need to reprocess

See [Data layout](../concepts/data-layout.md).
