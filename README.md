# prompt-exporter

[![CI](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml)

CLI to **sync AI conversation prompts** from multiple sources to your machine as JSON + Markdown.

**Sources**:

- ✅ `chatgpt` — [chatgpt.com](https://chatgpt.com/) history via Chromium CDP
- ✅ `lumo` — [lumo.proton.me](https://lumo.proton.me/) (Proton) via Chromium CDP / in-app Redux
- ✅ `perplexity` — [perplexity.ai](https://www.perplexity.ai/) threads via internal REST API (CDP session)
- ✅ `copilot` — Microsoft 365 Copilot Chat ([m365.cloud.microsoft/chat](https://m365.cloud.microsoft/chat)) via Substrate API + CDP
- 🎯 `claude` — [claude.ai](https://claude.ai/) (planned)
- 🎯 `gemini` — [gemini.google.com](https://gemini.google.com/) (planned)
- 🎯 `deepseek` — [chat.deepseek.com](https://chat.deepseek.com/) (planned)
- 🎯 `grok` — [grok.com](https://grok.com/) / xAI (planned)
- 🎯 `kimi` — [kimi.com](https://www.kimi.com/) / Moonshot (planned)

**Platforms**:

- ✅ **Linux** — primary development and packaging target (AUR `prompt-exporter` / `prompt-exporter-git`)
- 🎯 **Windows** — in focus (CDP + Chromium/Chrome paths)
- 🎯 **macOS** — in focus (CDP + Chromium/Chrome paths)

**User manual:** [docs/user/](./docs/user/README.md)  
**Developer guide:** [docs/DEVELOPER.md](./docs/DEVELOPER.md)

## What it's good for

- **Consolidate prompts from multiple sources** — Keep ChatGPT (and later other AIs) under one tree: `~/.prompt-exporter/{source}/`, as dated Markdown plus raw JSON.
- **Continue a conversation in another AI** — Sync, open the matching `.md`, and attach or paste it into Cursor, Claude, Codex, or a local model so the new assistant has the prior thread.
- **Pair with a `/compact` (or summarize) skill** — Export the full transcript locally, compact it into a handoff brief, then start a fresh session without losing decisions, constraints, or open questions.
- **Offline archive & search** — Incremental sync gives you a greppable history you control, independent of the vendor UI.
- **Project-scoped exports** — Pull one ChatGPT project (or the full account) into Markdown for a repo or knowledge base.
- **Cursor workspace rules** — `rule-install` drops always-on rules so plans/journals live under `.cursor/` in the repo (not `~/.cursor`).
- **Skills registries** — `skill-install` shallow-clones public catalogs over HTTPS and installs `SKILL.md` packs into `.cursor/skills/`.

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

### Arch Linux (AUR)

```bash
yay -S prompt-exporter          # stable (tagged release)
# yay -S prompt-exporter-git   # track master
```

### From GitHub (npm package)

```bash
npm install -g github:azbarcea/prompt-exporter
```

### From source

```bash
git clone https://github.com/azbarcea/prompt-exporter.git
cd prompt-exporter
npm install
npm run build
```

Then install the CLI onto your PATH — pick one:

```bash
# User scope (recommended; no root)
npm config set prefix "$HOME/.local"
npm install -g .
# ensure ~/.local/bin is on PATH, e.g. in ~/.bashrc:
#   export PATH="$HOME/.local/bin:$PATH"

# Or system-wide global
npm install -g .

# Or link for local development
npm link
```

Verify:

```bash
prompt-exporter --version
prompt-exporter --help
```

## Quick start

```bash
prompt-exporter chromium start
prompt-exporter sync --source chatgpt
prompt-exporter chromium start --url https://www.perplexity.ai/
prompt-exporter sync --source perplexity
prompt-exporter chromium start --url https://m365.cloud.microsoft/chat
prompt-exporter sync --source copilot
prompt-exporter rule-install --source cursor
prompt-exporter skill-install --list
prompt-exporter sources
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
