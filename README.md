# prompt-exporter

[![CI](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/azbarcea/prompt-exporter/actions/workflows/ci.yml)

CLI to **sync AI conversation prompts** from multiple sources to your machine as JSON + Markdown.

**Sources**:

- ✅ `chatgpt` — [chatgpt.com](https://chatgpt.com/) history via Chromium CDP

**User guide:** [docs/USER_GUIDE.md](./docs/USER_GUIDE.md)  
**Developer guide:** [docs/DEVELOPER.md](./docs/DEVELOPER.md)

Usage example:

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

Output directory: /home/john/.prompt-exporter/chatgpt/conversations
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

Default layout:

```text
~/.prompt-exporter/
  chatgpt/conversations/   # *.md + json/
  sources/chatgpt/token
  chromium/                # --isolated profile only
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
