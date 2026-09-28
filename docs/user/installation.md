# Installation

## Requirements

- **Node.js** ≥ 24 (when installing from npm or source)
- A **Chromium-based browser** for CDP sync (`chatgpt`, `lumo`, `perplexity`)
- **`git`** on `PATH` for skills registries (`skill-install` / `skill-registry`)

## Arch Linux (AUR)

```bash
# Stable release (recommended)
yay -S prompt-exporter

# Or track git master
yay -S prompt-exporter-git
```

The AUR package installs a single bundled binary at `/usr/bin/prompt-exporter` (no `node_modules` on disk).

If you previously used `npm link` or a user install under `~/.local/bin` and then switched to the AUR package, bash may still hash the old path:

```bash
type prompt-exporter   # may show hashed ~/.local/bin/...
hash -r                # clear the command hash table
type prompt-exporter   # should resolve to /usr/bin/prompt-exporter
```

## From GitHub (npm package)

```bash
npm install -g github:azbarcea/prompt-exporter
```

## From source

```bash
git clone https://github.com/azbarcea/prompt-exporter.git
cd prompt-exporter
npm install
npm run build
```

Install the CLI (pick one):

```bash
# User scope (recommended; no root)
npm config set prefix "$HOME/.local"
npm install -g .
export PATH="$HOME/.local/bin:$PATH"   # add to shell rc if needed

# System-wide
npm install -g .

# Dev link
npm link
```

## Verify

```bash
prompt-exporter --version
prompt-exporter --help
prompt-exporter sources
```

## Next steps

- [Quick start](./quick-start.md)
- [Environment variables](./concepts/environment.md)
