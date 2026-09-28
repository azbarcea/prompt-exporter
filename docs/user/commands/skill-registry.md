# `skill-registry`

Manage skills registries (GitHub / GitLab / Codeberg catalogs of `SKILL.md` trees).

## `skill-registry list`

List built-in and user registries (target agents + relative last-update when known).

```bash
prompt-exporter skill-registry list
prompt-exporter skill-registry list --json
```

| Option | Description |
|--------|-------------|
| `--json` | JSON output |

## `skill-registry add`

Add a user registry.

```bash
prompt-exporter skill-registry add <id> <source> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `id` | Registry id (e.g. `my-team-skills`) |
| `source` | `owner/repo` or `https://github.com\|gitlab.com\|codeberg.org/…[/tree/…]` |

### Options

| Option | Description |
|--------|-------------|
| `--host <host>` | `github` \| `gitlab` \| `codeberg` (inferred from URL when possible) |
| `--path <dir>` | Directory of skill folders (default `skills`, or path from URL) |
| `--ref <ref>` | Branch or tag (default `main`, or from URL) |
| `--nested` | Discover one level deeper (`category/skill`) |
| `--agents <list>` | Comma-separated targets (`cursor`, `claude-code`, `any`, …) |
| `--label <label>` | Display name |
| `--description <text>` | Short description |

### Examples

```bash
prompt-exporter skill-registry add acs spencerpauly/awesome-cursor-skills \
  --path resources --agents cursor
prompt-exporter skill-registry add gl \
  https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills \
  --host gitlab --agents gitlab-duo,claude-code
prompt-exporter skill-registry add mp mattpocock/skills \
  --nested --agents cursor,claude-code,any
```

User registries are stored in `~/.prompt-exporter/skills/registries.json`. Built-in ids cannot be reused or removed.

## `skill-registry remove`

```bash
prompt-exporter skill-registry remove <id>
```

Removes a **user** registry only.

## See also

- [Skills registries guide](../guides/skills.md)
- [`skill-install`](./skill-install.md)
