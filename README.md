# prompt-exporter

[![CI](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml)

CLI to **sync AI conversation prompts** from multiple sources to your machine as JSON + Markdown.

**Sources**:

- ✅ `chatgpt` — [chatgpt.com](https://chatgpt.com/) history via Chromium CDP
- 🎯 `claude` — [claude.ai](https://claude.ai/) (planned)
- 🎯 `gemini` — [gemini.google.com](https://gemini.google.com/) (planned)
- 🎯 `copilot` — [copilot.microsoft.com](https://copilot.microsoft.com/) / Bing Copilot (planned)
- 🎯 `perplexity` — [perplexity.ai](https://www.perplexity.ai/) (planned)
- 🎯 `grok` — [grok.x.ai](https://grok.x.ai/) / xAI (planned)

**Platforms**:

- ✅ **Linux** — primary development and packaging target (AUR `prompt-exporter-git`)
- 🎯 **Windows** — in focus (CDP + Chromium/Chrome paths)
- 🎯 **macOS** — in focus (CDP + Chromium/Chrome paths)

**User guide:** [docs/USER_GUIDE.md](./docs/USER_GUIDE.md)  
**Developer guide:** [docs/DEVELOPER.md](./docs/DEVELOPER.md)

## What it's good for

- **Consolidate prompts from multiple sources** — Keep ChatGPT (and later other AIs) under one tree: `~/.prompt-exporter/{source}/`, as dated Markdown plus raw JSON.
- **Continue a conversation in another AI** — Sync, open the matching `.md`, and attach or paste it into Cursor, Claude, Codex, or a local model so the new assistant has the prior thread.
- **Pair with a `/compact` (or summarize) skill** — Export the full transcript locally, compact it into a handoff brief, then start a fresh session without losing decisions, constraints, or open questions.
- **Offline archive & search** — Incremental sync gives you a greppable history you control, independent of the vendor UI.
- **Project-scoped exports** — Pull one ChatGPT project (or the full account) into Markdown for a repo or knowledge base.

### Handoff sketch (export → compact → continue)

```bash
prompt-exporter sync --source chatgpt
# Pick ~/.prompt-exporter/chatgpt/conversations/<date>.<title>.md
# In Cursor: /compact (or your summarize skill) on that file
# Start a new chat with the compact brief as context
```

## Usage example

```bash
$ prompt-exporter sync --source chatgpt --concurrency 6
✔ Authenticated (Chromium CDP, 6 workers)

Backup settings:
  Output: /home/john/.prompt-exporter/chatgpt
  Concurrency: 6
  Delay/gap: 200ms
  Transport: CDP tab pool (tune --concurrency / --delay; -v prints throttle stats)
  Incremental: true
  Download files: false

Main conversations

Listing     |████████████████████████████████████████| 100% | 1354/1354

Downloading |████████████████████████████████████████| 100% | 1354/1354

  Downloaded: 0, Skipped: 1354, Failed: 0

✔ Found 0 projects


Backup completed!
  Total conversations: 1354
  Downloaded: 0
  Skipped (unchanged): 1354
  Converted 1354 conversations to markdown

Output directory: /home/john/.prompt-exporter/chatgpt
```

Layout after sync:

```text
~/.prompt-exporter/
├── chatgpt
│   ├── backup.log
│   ├── conversations/
│   │   ├── <YYYY-mm-dd-HHMM>.<title>.md   # readable transcript
│   │   └── json/                          # raw conversation JSON
│   └── metadata.json
├── chromium/                              # --isolated CDP profile only
└── sources/
    └── chatgpt/token
```

## Install

```bash
yay -S prompt-exporter-git
# or
npm install -g github:azbarcea/prompt-exporter
# or from source
git clone https://github.com/azbarcea/prompt-exporter.git
cd prompt-exporter && npm install && npm run build && npm link
```

## Quick start

```bash
prompt-exporter chromium start
prompt-exporter sync --source chatgpt
prompt-exporter sources
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
