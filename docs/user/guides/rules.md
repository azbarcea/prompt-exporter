# Cursor workspace rules

`rule-install` installs always-on Cursor rules under the **project** `.cursor/` tree so plans and journals stay in the repo (not under `~/.cursor`).

## Install

From a Cursor workspace root:

```bash
prompt-exporter rule-install
prompt-exporter rule-install --source cursor --destination .cursor
prompt-exporter rule-install journal-logging,plans-location
prompt-exporter rule-install plans-location --force
prompt-exporter rule-install --list
```

## What it creates

| Path | Role |
|------|------|
| `.cursor/rules/*.mdc` | Rule files from the selected pack |
| `.cursor/plans/` | Companion directory (created empty if needed) |
| `.cursor/journal/` | Companion directory (created empty if needed) |

## Pack

Today the built-in pack id is `cursor` (`-s` / `--source cursor`), including rules such as `plans-location` and `journal-logging`.

Full options: [`rule-install`](../commands/rule-install.md).
