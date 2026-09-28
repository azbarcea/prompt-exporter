# `skill-install`

Install agent skills from a skills registry into `<destination>/skills/` (default `.cursor/skills/`).

Registries are shallow-cloned under `~/.prompt-exporter/skills/repos/` and scanned on disk.

## Usage

```bash
prompt-exporter skill-install --list
prompt-exporter skill-install --list --refresh
prompt-exporter skill-install --list --descriptions
prompt-exporter skill-install writing-commit-messages creating-pr
prompt-exporter skill-install --registry vercel-agent-skills --list
prompt-exporter skill-install --registry gitlab-ai-skills mr-review --convert
prompt-exporter skill-install --registry anthropic-skills pdf --convert --force
prompt-exporter skill-install --all --force
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[skills...]` | Skill ids (space or comma separated). Required unless `--list` or `--all`. |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-r, --registry <id>` | `awesome-cursor-skills` | Skills registry |
| `-d, --destination <dir>` | `.cursor` | Project config root |
| `--force` | off | Overwrite existing skill directories |
| `--refresh` | off | Re-fetch the local registry git clone |
| `--convert` | off | Adapt `SKILL.md` when registry agents ≠ destination |
| `--as-is` | off | Install without converting on agent mismatch |
| `--agent <name>` | inferred | Destination agent (`cursor`, `claude-code`, `codex`, …) |
| `--list` | off | List skills in the registry |
| `--descriptions` | off | With `--list`, include descriptions from each `SKILL.md` |
| `--all` | off | Install every skill in the registry |
| `--json` | off | JSON output |

## Agent conversion

If the registry’s target agents do not include the destination agent (and do not include `any`):

- TTY: prompt to convert
- Non-TTY: require `--convert` or `--as-is`

## See also

- [Skills registries guide](../guides/skills.md)
- [`skill-registry`](./skill-registry.md)
