# Skills registries

Install agent skills (`SKILL.md` folders) from public catalogs into `.cursor/skills/` (or another destination).

## How catalogs are fetched

Registries are **shallow-cloned over HTTPS** into:

```text
~/.prompt-exporter/skills/repos/{github|gitlab|codeberg}/…
```

Listing and install scan the local tree (no forge Contents API — avoids rate limits). After the first clone, you can work offline. Use `--refresh` to pull updates; otherwise clones refresh at most every **6 hours**.

Requires **`git`** on `PATH`.

## List registries and skills

```bash
prompt-exporter skill-registry list
prompt-exporter skill-install --list
prompt-exporter skill-install --list --refresh
prompt-exporter skill-install --list --descriptions
```

`skill-registry list` shows target **agents/AIs** and relative last-update time (from the local clone when present).

## Install skills

```bash
prompt-exporter skill-install writing-commit-messages creating-pr
prompt-exporter skill-install --registry vercel-agent-skills --list
prompt-exporter skill-install --registry mattpocock-skills tdd grill-me
prompt-exporter skill-install --registry gitlab-ai-skills mr-review --convert
prompt-exporter skill-install --registry sbstjn-skills typescript
prompt-exporter skill-install --all --force
```

Destination default: `.cursor` → writes under `.cursor/skills/`.

## Agent mismatch and convert

Each registry declares target agents (`cursor`, `claude-code`, `gitlab-duo`, `any`, …). If the destination agent (inferred from `--destination`, or set with `--agent`) is not supported:

- Interactive TTY: you are asked whether to convert `SKILL.md`
- Non-interactive: pass `--convert` or `--as-is`

Conversion lightly adapts frontmatter and common path hints (e.g. toward `.cursor/skills`).

## Built-in registries

| Id | Host | Path | Agents (primary) | Notes |
|----|------|------|------------------|-------|
| `awesome-cursor-skills` | GitHub | `resources` | cursor | Default registry |
| `vercel-agent-skills` | GitHub | `skills` | any, cursor, … | |
| `anthropic-skills` | GitHub | `skills` | claude-code, any | |
| `mattpocock-skills` | GitHub | `skills` | cursor, claude-code, … | nested |
| `posthog-skills` | GitHub | `skills` | any, cursor, … | nested |
| `sentry-skills` | GitHub | `skills` | any, cursor, … | |
| `obra-superpowers` | GitHub | `skills` | claude-code, cursor, any | |
| `gitlab-ai-skills` | GitLab | `skills` | gitlab-duo, claude-code, opencode | |
| `sbstjn-skills` | Codeberg | `skills` | cursor, any | |

## Add your own catalog

```bash
prompt-exporter skill-registry add team \
  https://github.com/org/skills/tree/main/skills --agents cursor,any
prompt-exporter skill-registry add gl \
  https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills \
  --agents gitlab-duo
prompt-exporter skill-registry remove team
```

User registries are stored in `~/.prompt-exporter/skills/registries.json`.

## Commands

- [`skill-install`](../commands/skill-install.md)
- [`skill-registry`](../commands/skill-registry.md)
