import type { RuleTemplate } from '../types.js';

export const plansLocationRule: RuleTemplate = {
  id: 'plans-location',
  filename: 'plans-location.mdc',
  description:
    'Keep project plans under .cursor/plans (not ~/.cursor/plans)',
  ensureDirs: ['plans'],
  content: `---
description: Project plans live under .cursor/plans (not ~/.cursor/plans)
alwaysApply: true
---

# Plans location

- Store and edit **project** plans in [\`.cursor/plans/\`](.cursor/plans/) inside this repo.
- Do **not** write new project plans only under \`~/.cursor/plans/\`.
- When creating a plan for this workspace, prefer:

\`\`\`text
.cursor/plans/<YYYY-mm-dd-HHMM>.<slug>.plan.md
\`\`\`

- **YYYY-mm-dd-HHMM** — local time when the plan is created (24h).
- **slug** — short kebab-case topic (e.g. \`perplexity-sync\`, \`rule-install\`).
- If Cursor’s UI offers a project plans folder, use that path (same tree as \`.cursor/plans/\`).
`,
};

export const journalLoggingRule: RuleTemplate = {
  id: 'journal-logging',
  filename: 'journal-logging.mdc',
  description:
    'Keep session journals under .cursor/journal with timestamped filenames',
  ensureDirs: ['journal'],
  content: `---
description: Session journals live under .cursor/journal with timestamped filenames
alwaysApply: true
---

# Journal logging

## Location

Workspace root: [\`.cursor/journal/\`](.cursor/journal/)

Do **not** write session journals only under \`~/.cursor/\` (or other global paths) when working in this repo.

## Filename

\`\`\`text
YYYY-mm-dd-HHMM.<Title>.md
\`\`\`

Examples:

- \`2026-09-26-2121.some-sample-title.md\`
- \`2026-09-25-1900.create-a-page.md\`

- **YYYY-mm-dd-HHMM** — local time when the journal entry is written (24h).
- **Title** — short kebab-case slug (what the session did).

## Contents

Each journal should document:

1. **Summary** — one short paragraph of outcomes
2. **What was done** — steps, decisions, files touched
3. **Outputs** — command/API results **redacted** (no passwords, keys, session tokens)
4. **Commits** — hash + subject when repos were committed
5. **Follow-ups** — open checkboxes

Do not put secrets in journals.
`,
};
