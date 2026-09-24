# Changelog

## 2.0.1

### Changed

- Republish after rewriting `master` commit messages to remove Cursor `Co-authored-by` trailers (no product/API change vs 2.0.0)
- Keep GitHub Release `v2.0.0` as-is; this tag is the clean tip for installs
- Require **Node.js >= 24**; CI matrix is Node 24 and 26 only (dropped deprecated 20/22)

## 2.0.0

### Breaking

- Renamed project/CLI from `chatgpt-exporter` to **`prompt-exporter`**
- Config home is `~/.prompt-exporter` (migrates from `~/.chatgpt-exporter` when present)
- ChatGPT data lives under `~/.prompt-exporter/chatgpt/`
- Token file: `~/.prompt-exporter/sources/chatgpt/token`
- Env vars: `PROMPT_EXPORTER_*` (legacy `CHATGPT_EXPORTER_*` / `CHATGPT_TOKEN` still read where noted)
- License: **Apache-2.0**
- No `chatgpt-exporter` binary alias

### Added

- `--source` flag (default `chatgpt`) and `sources` command
- Pluggable source registry (`src/sources/`)
- AUR packages: `prompt-exporter` (stable tags) and `prompt-exporter-git`

## 1.3.1

### Added

- `chromium start` reuses an existing CDP port (no second window; `--force` to override)
- `token` reuses the CDP browser: activates an existing ChatGPT tab or opens a new tab in that session, and tries to print `CHATGPT_TOKEN` automatically
- `token` detects anonymous `/api/auth/session` (WARNING_BANNER only), opens ChatGPT login in the CDP window, and waits for login (`--no-wait` / `--timeout`)
- GitHub Actions CI (`.github/workflows/ci.yml`) — typecheck, build, test on Node 20/22/24
- Developer guide: `docs/DEVELOPER.md`
- `npm run typecheck`, `npm test`, `npm run ci`
- Unit/smoke tests under `tests/`

### Changed

- `sync` / `backup` are **incremental by default**; use `--no-incremental` for a full re-download
- `chromium start` defaults to the **system** Chromium profile (`~/.config/chromium`) so existing ChatGPT login is reused; use `--isolated` for the old blank profile
- `chromium start` reuses an already-running CDP browser (focus/open a tab there; does not spawn another profile)
- `token` extracts `accessToken` from the session page JSON and saves `~/.chatgpt-exporter/token`; `sync` uses it automatically (no manual export)
- CDP port auto-discovery (9222/9223/… or `CHATGPT_EXPORTER_CDP_PORT`) when the default port is idle
- Global `--help` is standard (no install blurb); typical flow kept at the end

## 1.3.0

### Added

- `chatgpt-exporter chromium start [--port 9222]` — dedicated Chromium with remote debugging (CDP)
- `sync` command (alias of `backup`) for ongoing history sync
- Default data directory: `~/.chatgpt-exporter/data` (override with `-o` / `CHATGPT_EXPORTER_DATA`)
- Config root `~/.chatgpt-exporter/` with Chromium profile under `chromium/`
- User Guide: `docs/USER_GUIDE.md`
- Global `--help` with env vars and default paths

### Changed

- `backup` / `sync` default output is no longer `./chatgpt-export`
- Token / auth hints point at `chromium start` + `token` + `sync`

## 1.2.0

### Added

- `token` command opens Chromium to `chatgpt.com/api/auth/session` for copying `accessToken`
- MIT `LICENSE` file
- AUR packaging under `aur/` (`chatgpt-exporter-git`)

### Changed

- Browser request headers updated for Linux Chromium 152 (matches Arch `chromium`)
- Repository metadata pointed at the azbarcea fork
- Token help text prefers Chromium session URL over DevTools scraping

## 1.1.0

### Added

- `--download-files` flag to download file attachments and images referenced in conversations
- Two-step file download: fetches metadata from ChatGPT API, then downloads the actual file
- Downloaded files stored in `files/{fileId}/` with original filenames, deduplicated across conversations
- Markdown files reference local copies with relative paths when files are available
- Support for three file reference types: `image_asset_pointer`, `attachments`, and `citations`
- Progress bar with Downloaded/Skipped/Failed stats during file downloads
- Failed file IDs persisted in `metadata.json` to skip on subsequent incremental runs
- Errors grouped by message in output for cleaner reporting
- Privacy & Security section in README

### Fixed

- Pagination limit increased from 28 to 100 (the API maximum), reducing listing requests by ~3x
- `listProjectConversations` options made properly optional

## 1.0.0

### Added

- Full backup of all ChatGPT conversations and projects as JSON
- Automatic Markdown conversion with message threading
- Incremental backups (`--incremental`) — only downloads new or updated conversations
- Project support — backs up project conversations in separate directories
- Single project backup with `--project <name-or-id>`
- `list` command to preview conversations without downloading
- `projects` command to list all ChatGPT projects
- Configurable concurrency, delay, and output directory
- Retry with exponential backoff for rate limits and transient errors
- Progress bars for listing and downloading phases
- JSON output option for `list` and `projects` commands
