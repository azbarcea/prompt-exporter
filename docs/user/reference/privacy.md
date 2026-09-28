# Privacy and security

- Runs **locally** on your machine.
- Contacts the **source site** (ChatGPT, Lumo, Perplexity, …) using **your** browser session or optional token.
- **No telemetry** from prompt-exporter.
- Skill registry clones use public HTTPS git URLs by default; optional forge tokens only if you configure them.
- Tokens and clones live under `~/.prompt-exporter/` — treat that directory like any other credential store (permissions, backups, shared machines).

## Recommendations

- Prefer CDP session sync over long-lived Bearer tokens when possible.
- Use `--isolated` Chromium if you want a profile separate from your daily browser.
- Do not commit `~/.prompt-exporter/sources/*/token` or private clone credentials into git.
