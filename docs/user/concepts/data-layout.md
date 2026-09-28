# Data layout

## Home directory

Default config / data home: `~/.prompt-exporter/`  
Override with `PROMPT_EXPORTER_HOME`.

```text
~/.prompt-exporter/
├── chatgpt/                      # --source chatgpt
│   ├── backup.log
│   ├── metadata.json
│   ├── conversations/
│   │   ├── YYYY-mm-dd-HHMM.Title.md
│   │   └── json/<conversation-id>.json
│   └── projects/                 # when projects exist
├── lumo/
├── perplexity/
├── sources/
│   └── chatgpt/token             # saved accessToken (optional)
├── chromium/                     # only with: chromium start --isolated
└── skills/
    ├── registries.json           # user-added skill registries
    ├── repos/                    # shallow clones of skill catalogs
    │   └── github/owner/repo/
    └── repo-meta.json            # optional forge activity cache
```

## Conversation files

| Artifact | Purpose |
|----------|---------|
| `conversations/*.md` | Human-readable transcript with YAML frontmatter |
| `conversations/json/*.json` | Raw conversation payload from the source |
| `metadata.json` | Sync bookkeeping (timestamps, ids) |
| `backup.log` | Sync log |

Markdown filenames use an update stamp (`YYYY-mm-dd-HHMM`) plus a sanitized title.

## Output override

| Flag / env | Effect |
|------------|--------|
| `-o` / `--output <dir>` | That source’s data root for this run |
| `PROMPT_EXPORTER_DATA` | Parent directory of source folders (instead of home) |
| `PROMPT_EXPORTER_HOME` | Replaces `~/.prompt-exporter` entirely |

## Skills cache

Skill catalogs are shallow-cloned under `skills/repos/` so listing and install work offline after the first fetch. See [Skills registries](../guides/skills.md).
