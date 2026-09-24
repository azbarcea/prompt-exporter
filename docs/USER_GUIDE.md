# prompt-exporter — User Guide

## Purpose

**prompt-exporter** downloads conversation history from AI chat products (**sources**) so you can:

- Keep a local, searchable archive (JSON + Markdown)
- Re-sync incrementally as chats change
- Hand transcripts to another AI as context

The first source is **chatgpt** (chatgpt.com). Planned next: Claude, Gemini, Copilot, Perplexity, and Grok.

**Platforms:** Linux is supported today; Windows and macOS are in focus for CDP/browser path parity.

## Install

### Arch Linux (AUR)

```bash
# Stable release (recommended)
yay -S prompt-exporter

# Or track git master
yay -S prompt-exporter-git
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

Install the CLI (pick one):

```bash
# User scope (recommended)
npm config set prefix "$HOME/.local"
npm install -g .
export PATH="$HOME/.local/bin:$PATH"   # add to shell rc if needed

# Global
npm install -g .

# Dev link
npm link
```

## Layout

```text
~/.prompt-exporter/
  chatgpt/                 # --source chatgpt data root
    conversations/
      YYYY-mm-dd-HHMM.Title.md
      json/<id>.json
    projects/
    metadata.json
    backup.log
  sources/
    chatgpt/token
  chromium/                # only with: chromium start --isolated
```

| Variable / flag | Meaning |
|-----------------|---------|
| `-s` / `--source` | Source id (default: `chatgpt`) |
| `-o` / `--output` | Override that source’s data directory |
| `PROMPT_EXPORTER_HOME` | Replace `~/.prompt-exporter` |
| `PROMPT_EXPORTER_DATA` | Parent of source dirs |
| `PROMPT_EXPORTER_BROWSER` | Chromium binary |
| `PROMPT_EXPORTER_CHATGPT_TOKEN` | Optional Bearer for chatgpt |

## Typical workflow

```bash
prompt-exporter chromium start
prompt-exporter sync --source chatgpt
prompt-exporter sync --download-files
prompt-exporter sync --no-incremental   # force full re-download
prompt-exporter sources
```

`sync` is incremental by default (skips unchanged `update_time`).

Auth prefers a logged-in Chromium CDP session. Node Bearer alone is often blocked by Cloudflare.

## Commands

```text
prompt-exporter --help
prompt-exporter sources
prompt-exporter chromium start --help
prompt-exporter sync --help
```

| Command | What it does |
|---------|----------------|
| `sources` | List registered sources |
| `chromium start` | Start/reuse Chromium with CDP |
| `token` | Extract/save chatgpt accessToken |
| `sync` / `backup` | Download conversations |
| `list` | Preview conversations |
| `projects` | List ChatGPT projects |

## Privacy

Runs locally. Contacts the source site with your session. No telemetry.
