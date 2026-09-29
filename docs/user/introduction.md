# Introduction

**prompt-exporter** is a command-line tool that downloads conversation history from AI chat products (**sources**) and stores it on your machine as JSON and Markdown.

## What you can do with it

- Keep a **local, searchable archive** under `~/.prompt-exporter/{source}/`
- **Re-sync incrementally** as chats change (skip unchanged threads)
- **Hand transcripts** to another AI (Cursor, Claude, Codex, local models) as context
- Install **Cursor workspace rules** so plans and journals live in the repo
- Install **agent skills** (`SKILL.md` trees) from public registries into `.cursor/skills/`

## Supported sources today

| Source id | Product | How sync works |
|-----------|---------|----------------|
| `chatgpt` | [chatgpt.com](https://chatgpt.com/) | Chromium CDP (logged-in session) |
| `lumo` | [lumo.proton.me](https://lumo.proton.me/) | Chromium CDP; reads decrypted in-app Redux state |
| `perplexity` | [perplexity.ai](https://www.perplexity.ai/) | Internal REST via logged-in CDP cookies |
| `copilot` | [m365.cloud.microsoft/chat](https://m365.cloud.microsoft/chat) | Substrate API via logged-in CDP (MSAL) |

Planned: `claude`, `gemini`, `deepseek`, `grok`, `kimi`.

## Design principles

- **Runs locally** — no telemetry; the tool only talks to the source site with *your* session
- **Incremental by default** — `sync` skips conversations whose `update_time` has not changed
- **Readable + raw** — Markdown for humans and handoff; JSON for fidelity
- **Browser session first** — Cloudflare and vendor UIs often block bare Bearer tokens; CDP uses a real Chromium login

## Who this manual is for

End users installing and running the CLI. For building from source internals, packaging, or adding a source, see the [developer guide](../DEVELOPER.md).

## Next steps

- [Install](./installation.md)
- [Quick start](./quick-start.md)
