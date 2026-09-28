# prompt-exporter User Manual

Local archive of AI conversation history, plus helpers for Cursor workspace rules and agent skills.

This manual is the published user documentation for **prompt-exporter**.

| | |
|---|---|
| **CLI** | `prompt-exporter` |
| **License** | Apache-2.0 |
| **Platforms** | Linux (primary); Windows and macOS in focus |
| **Version** | Matches the package version (`prompt-exporter --version`) |

## Contents

### Getting started

1. [Introduction](./introduction.md) — what it does and when to use it
2. [Installation](./installation.md) — AUR, npm, and from source
3. [Quick start](./quick-start.md) — first sync in a few commands

### Concepts

4. [Sources](./concepts/sources.md) — chatgpt, lumo, perplexity, and planned sources
5. [Data layout](./concepts/data-layout.md) — `~/.prompt-exporter/` tree and output files
6. [Chromium and CDP](./concepts/chromium-cdp.md) — how authentication works
7. [Environment variables](./concepts/environment.md) — home, data, browser, tokens

### Guides

8. [Sync ChatGPT](./guides/chatgpt.md)
9. [Sync Lumo](./guides/lumo.md)
10. [Sync Perplexity](./guides/perplexity.md)
11. [Handoff to another AI](./guides/handoff.md)
12. [Cursor workspace rules](./guides/rules.md)
13. [Skills registries](./guides/skills.md)

### Command reference

14. [Command overview](./commands/README.md)
15. [`sources`](./commands/sources.md)
16. [`chromium`](./commands/chromium.md)
17. [`token`](./commands/token.md)
18. [`sync` / `backup`](./commands/sync.md)
19. [`list`](./commands/list.md)
20. [`projects`](./commands/projects.md)
21. [`rule-install`](./commands/rule-install.md)
22. [`skill-install`](./commands/skill-install.md)
23. [`skill-registry`](./commands/skill-registry.md)

### Reference

24. [Privacy and security](./reference/privacy.md)
25. [Troubleshooting](./reference/troubleshooting.md)

## Related docs

- Developer guide: [`docs/DEVELOPER.md`](../DEVELOPER.md)
- Changelog: [`CHANGELOG.md`](../../CHANGELOG.md)
