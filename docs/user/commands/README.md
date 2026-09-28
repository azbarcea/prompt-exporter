# Command overview

```bash
prompt-exporter --help
prompt-exporter --version
prompt-exporter <command> --help
```

| Command | Summary |
|---------|---------|
| [`sources`](./sources.md) | List registered prompt sources |
| [`chromium`](./chromium.md) | Start / reuse Chromium with CDP |
| [`token`](./token.md) | Extract ChatGPT accessToken from CDP session |
| [`sync`](./sync.md) | Download conversations (JSON + Markdown) |
| [`backup`](./sync.md) | Alias for `sync` |
| [`list`](./list.md) | List conversations without downloading |
| [`projects`](./projects.md) | List ChatGPT projects |
| [`rule-install`](./rule-install.md) | Install Cursor workspace rules under `.cursor/` |
| [`skill-install`](./skill-install.md) | Install skills from a registry into `.cursor/skills/` |
| [`skill-registry`](./skill-registry.md) | List / add / remove skills registries |

## Global patterns

- Many sync-related commands accept `-s` / `--source` (default `chatgpt`).
- Prefer `prompt-exporter <command> --help` for the option list that matches your installed version.
