# Environment variables

| Variable | Meaning |
|----------|---------|
| `PROMPT_EXPORTER_HOME` | Replace `~/.prompt-exporter` |
| `PROMPT_EXPORTER_DATA` | Parent of source data dirs (default: home) |
| `PROMPT_EXPORTER_BROWSER` | Absolute path to Chromium/Chrome binary |
| `PROMPT_EXPORTER_CDP_PORT` | Preferred CDP port (CLI also auto-discovers `9222`, `9223`, …) |
| `PROMPT_EXPORTER_CHATGPT_TOKEN` | Optional Bearer fallback for the `chatgpt` source |
| `CHATGPT_TOKEN` | Legacy alias still accepted for chatgpt Bearer |
| `PROMPT_EXPORTER_GITHUB_TOKEN` | Optional GitHub API token (skills activity / legacy API paths) |
| `GITHUB_TOKEN` | Alias for GitHub token |
| `PROMPT_EXPORTER_GITLAB_TOKEN` | Optional GitLab API token |
| `GITLAB_TOKEN` | Alias for GitLab token |

## Flags that often replace env vars

| Flag | Related env |
|------|-------------|
| `-o` / `--output` | Per-run data dir (vs `PROMPT_EXPORTER_DATA` / home) |
| `--port` | `PROMPT_EXPORTER_CDP_PORT` |
| `-t` / `--token` | `PROMPT_EXPORTER_CHATGPT_TOKEN` |

## Skills and git

`skill-install` clones catalogs with **git over HTTPS**. Forge tokens are not required for public clones; they only matter for optional API metadata or private repos.
