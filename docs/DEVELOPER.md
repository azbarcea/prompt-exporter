# prompt-exporter — Developer Guide

## Overview

TypeScript ESM CLI that:

1. Talks to a **source** (first: ChatGPT via Chromium CDP in-page `fetch`)
2. Writes JSON + Markdown under `~/.prompt-exporter/{source}/`
3. Registers sources in `src/sources/registry.ts`

## Layout

```text
src/
  cli/                     # commander entry + commands
  sources/
    types.ts               # Source interface
    registry.ts
    chatgpt/               # chatgpt source (api/, index.ts)
    lumo/                  # lumo.proton.me (CDP Redux export)
  services/                # storage, markdown, backup (source-agnostic)
  utils/                   # paths, credentials, cdp, browser
aur/
  prompt-exporter/         # AUR stable (GitHub tag tarball)
  prompt-exporter-git/     # AUR VCS (tracks master)
  publish.sh
```

## Release (2.0.x)

`package.json` is track `package.json` (currently 2.0.1). Shipping steps:

### 1. Push release prep (this commit) and tag

```bash
cd /path/to/prompt-exporter
git push origin master

git tag -a v2.0.0 -m "prompt-exporter 2.0.0"
git push origin v2.0.0
```

### 2. GitHub Release

```bash
# If gh is installed:
gh release create v2.0.0 --title "2.0.0" --notes-file - <<'EOF'
See CHANGELOG.md for breaking changes (rebrand, Apache-2.0, multi-source layout).
EOF

# Or: GitHub → Releases → Draft from tag v2.0.0 → paste CHANGELOG 2.0.0 section
```

### 3. Fill AUR stable checksum

```bash
TARBALL_URL="https://github.com/azbarcea/prompt-exporter/archive/refs/tags/v2.0.0.tar.gz"
SUM=$(curl -sL "$TARBALL_URL" | sha256sum | awk '{print $1}')
echo "$SUM"

# Update aur/prompt-exporter/PKGBUILD sha256sums and regenerate .SRCINFO:
sed -i "s/sha256sums=.*/sha256sums=('${SUM}')/" aur/prompt-exporter/PKGBUILD
( cd aur/prompt-exporter && makepkg --printsrcinfo > .SRCINFO )

git add aur/prompt-exporter
git commit -m "chore(aur): set sha256 for prompt-exporter 2.0.0"
git push origin master
```

### 4. Publish AUR packages

Requires SSH key registered on [AUR](https://aur.archlinux.org) (`ssh aur@aur.archlinux.org`).

```bash
# First-time package names (if empty clone fails, publish.sh inits and pushes):
./aur/publish.sh prompt-exporter      # stable 2.0.0
./aur/publish.sh prompt-exporter-git  # rolling
```

If `prompt-exporter` or `prompt-exporter-git` does not exist yet on AUR, create them once via the AUR web UI (“Submit”) or by pushing a new empty repo with `git push -u origin master` after the script’s `git init` path — you must be logged in as the maintainer.

### 5. Optional: npm registry

Not required (install via `github:azbarcea/prompt-exporter` works). To publish:

```bash
npm login
npm publish --access public
```

### 6. Smoke after install

```bash
yay -S prompt-exporter
prompt-exporter --version   # 2.0.0
prompt-exporter sources
```

## Develop

```bash
git clone https://github.com/azbarcea/prompt-exporter.git
cd prompt-exporter
npm install
npm run typecheck
npm test
npm run dev -- --help
npm run dev -- sync --source chatgpt -v
```

## Paths

| Helper | Default |
|--------|---------|
| `getConfigDir()` | `~/.prompt-exporter` |
| `getSourceDataDir('chatgpt')` | `~/.prompt-exporter/chatgpt` |
| `getSourceTokenPath('chatgpt')` | `~/.prompt-exporter/sources/chatgpt/token` |

Env: `PROMPT_EXPORTER_HOME`, `PROMPT_EXPORTER_DATA`, `PROMPT_EXPORTER_BROWSER`, `PROMPT_EXPORTER_CDP_PORT`.

## Adding a source

1. Implement `Source` in `src/sources/<id>/`
2. Register in `src/sources/registry.ts`
3. Wire `sync` / `list` in `src/cli/index.ts` for that id

## License

Apache-2.0 — `LICENSE` + `NOTICE`.
