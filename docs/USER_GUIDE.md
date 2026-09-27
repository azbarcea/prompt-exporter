# prompt-exporter — User Guide

## Purpose

**prompt-exporter** downloads conversation history from AI chat products (**sources**) so you can:

- Keep a local, searchable archive (JSON + Markdown)
- Re-sync incrementally as chats change
- Hand transcripts to another AI as context

The first implemented sources are **chatgpt** (chatgpt.com), **lumo** ([lumo.proton.me](https://lumo.proton.me/)), and **perplexity** ([perplexity.ai](https://www.perplexity.ai/)). Planned next: `claude`, `gemini`, `deepseek`, `copilot` (Microsoft 365), `grok`, and `kimi`.

**Platforms:** Linux is supported today; Windows and macOS are in focus for CDP/browser path parity.

## Install

### Arch Linux (AUR)

```bash
# Stable release (recommended)
yay -S prompt-exporter

# Or track git master
yay -S prompt-exporter-git
```

The AUR package installs a single bundled binary at `/usr/bin/prompt-exporter` (no `node_modules` on disk).

If you previously used `npm link` / a user install under `~/.local/bin` and then removed that path, bash may still **hash** the old location:

```bash
type prompt-exporter   # may show hashed ~/.local/bin/...
hash -r                # clear the command hash table
type prompt-exporter   # should resolve to /usr/bin/prompt-exporter
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

### Lumo (Proton)

Lumo encrypts payloads on the server. Sync reads the **decrypted** in-app Redux store over CDP after login:

```bash
prompt-exporter chromium start --url https://lumo.proton.me/
# log in; wait until chats appear in the sidebar
prompt-exporter sync --source lumo
prompt-exporter list --source lumo
```

`sync` is incremental by default (skips unchanged `update_time`).

Auth prefers a logged-in Chromium CDP session. Node Bearer alone is often blocked by Cloudflare.

### Perplexity

There is no official public API for thread history. Sync calls Perplexity’s internal REST endpoints (`/rest/thread/list_ask_threads`, `/rest/thread/{uuid}`) from a logged-in Chromium tab (cookies / Cloudflare):

```bash
prompt-exporter chromium start --url https://www.perplexity.ai/
# log in; Library threads should be visible
prompt-exporter sync --source perplexity
prompt-exporter list --source perplexity
```

`sync` is incremental by default (skips unchanged `update_time`).

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
| `rule-install` | Install Cursor workspace rules (`.cursor/rules/`) |
| `skill-install` | Install skills from a registry into `.cursor/skills/` |
| `skill-registry` | List / add / remove skills registries |

### Cursor workspace rules

Keep plans and session journals **in the repo** (not under `~/.cursor`):

```bash
# From any Cursor workspace root — installs all cursor rules into ./.cursor
prompt-exporter rule-install

# Explicit (same defaults)
prompt-exporter rule-install --source cursor --destination .cursor journal-logging,plans-location

prompt-exporter rule-install --list
prompt-exporter rule-install plans-location --force   # overwrite
```

Creates `.cursor/rules/*.mdc` plus empty `.cursor/plans/` and `.cursor/journal/` as needed.

### Skills registries

Install Cursor agent skills (`SKILL.md` folders) from GitHub catalogs into `.cursor/skills/`:

```bash
# Built-in registry → spencerpauly/awesome-cursor-skills/resources
prompt-exporter skill-registry list
prompt-exporter skill-install --list
prompt-exporter skill-install writing-commit-messages creating-pr

# Add another catalog (owner/repo or full tree URL)
prompt-exporter skill-registry add team https://github.com/org/skills/tree/main/skills
prompt-exporter skill-install --registry team some-skill
```

Optional: `PROMPT_EXPORTER_GITHUB_TOKEN` or `GITHUB_TOKEN` for higher GitHub API rate limits.

## Privacy

Runs locally. Contacts the source site with your session. No telemetry.
