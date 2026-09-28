# `rule-install`

Install Cursor workspace rules so plans and journals live under the project `.cursor/` tree (not `~/.cursor`).

## Usage

```bash
prompt-exporter rule-install
prompt-exporter rule-install --source cursor --destination .cursor
prompt-exporter rule-install journal-logging,plans-location
prompt-exporter rule-install plans-location --force
prompt-exporter rule-install --list
prompt-exporter rule-install --list --json
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[rules...]` | Rule ids (space or comma separated). Omit to install **all** rules for `--source`. |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --source <id>` | `cursor` | Rule pack |
| `-d, --destination <dir>` | `.cursor` | Project config root (rules → `<dir>/rules/`) |
| `--force` | off | Overwrite existing rule files |
| `--list` | off | List available rules for `--source` (no install) |
| `--json` | off | JSON output |

## Effects

Creates `.cursor/rules/*.mdc` and ensures companion dirs `.cursor/plans/` and `.cursor/journal/` exist when needed.

## See also

- [Cursor workspace rules guide](../guides/rules.md)
