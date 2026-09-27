# prompt-exporter release automation
#
# Order (intentional):
#   0) bump VERSION=x.y.z  — update package.json (+ CHANGELOG stub), commit
#   1) npmjs.com           — validate/publish from the release commit
#   2) GitHub              — annotated tag + Release (source tarball)
#   3) AUR                 — stable package pins the GitHub tag tarball sha256
#
# Usage:
#   make help
#   make bump VERSION=2.2.0
#   make release CONFIRM=1

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

# From package.json unless overridden on the command line (e.g. make bump VERSION=2.2.0).
VERSION ?= $(shell node -p "require('./package.json').version")
TAG     := v$(VERSION)
REPO    := azbarcea/prompt-exporter
REMOTE  := origin
BRANCH  := $(shell git rev-parse --abbrev-ref HEAD)
AUR_STABLE  := aur/prompt-exporter
AUR_GIT     := aur/prompt-exporter-git

.PHONY: help version bump check npm-auth npm-pack npm-publish \
	github-tag github-release \
	aur-sha aur-commit aur-publish \
	release smoke

help:
	@echo "prompt-exporter (package.json $$(node -p "require('./package.json').version"))"
	@echo ""
	@echo "Pipeline:  bump → npmjs → GitHub tag/release → AUR (GitHub tarball)"
	@echo ""
	@echo "  make bump VERSION=x.y.z   set package.json version + CHANGELOG stub; commit"
	@echo "  make version              print current package.json version"
	@echo "  make check                typecheck + tests; refuse dirty tree"
	@echo "  make npm-auth             verify npmjs login (whoami)"
	@echo "  make npm-pack             dry-run npm pack"
	@echo "  make npm-publish          publish to npmjs.com (public; skips if version exists)"
	@echo "  make github-tag           create/push annotated tag v<version>"
	@echo "  make github-release       gh release from tag (CHANGELOG section)"
	@echo "  make aur-sha              set PKGBUILD pkgver + sha256 from GitHub tarball"
	@echo "  make aur-commit           commit AUR metadata (if changed) and push"
	@echo "  make aur-publish          push PKGBUILDs to aur.archlinux.org"
	@echo "  make release CONFIRM=1    check → npm → github → aur"
	@echo "  make smoke                print install smoke commands"
	@echo ""
	@echo "Auth / resume:"
	@echo "  npm login                 # or: export NPM_TOKEN=npm_… (automation token)"
	@echo "  make release CONFIRM=1 SKIP_NPM=1   # resume after npm already published"
	@echo ""
	@echo "Example:"
	@echo "  make bump VERSION=2.2.0"
	@echo "  make release CONFIRM=1"

version:
	@node -p "require('./package.json').version"

# Bump package.json (and lockfile) to VERSION=x.y.z; stub CHANGELOG; commit.
# Does not tag or publish — edit CHANGELOG, then make release CONFIRM=1.
bump:
	@NEW="$(VERSION)"; \
	OLD=$$(node -p "require('./package.json').version"); \
	if [[ "$(origin VERSION)" != "command line" ]]; then \
	  echo "Usage: make bump VERSION=x.y.z" >&2; \
	  echo "  current: $$OLD" >&2; \
	  exit 1; \
	fi; \
	if [[ ! "$$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$$ ]]; then \
	  echo "error: VERSION must look like semver (got '$$NEW')" >&2; \
	  exit 1; \
	fi; \
	if [[ "$$NEW" == "$$OLD" ]]; then \
	  echo "error: already at $$OLD (pass a different VERSION=)" >&2; \
	  exit 1; \
	fi; \
	echo "==> bump $$OLD → $$NEW"; \
	npm version "$$NEW" --no-git-tag-version; \
	if ! grep -q "^## $$NEW$$" CHANGELOG.md; then \
	  echo "==> insert CHANGELOG stub for $$NEW"; \
	  { \
	    echo "# Changelog"; \
	    echo ""; \
	    echo "## $$NEW"; \
	    echo ""; \
	    echo "### Changed"; \
	    echo ""; \
	    echo "- TBD"; \
	    echo ""; \
	    tail -n +2 CHANGELOG.md; \
	  } > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md; \
	else \
	  echo "==> CHANGELOG already has ## $$NEW"; \
	fi; \
	git add package.json package-lock.json CHANGELOG.md; \
	git commit -m "chore: bump version to $$NEW"; \
	echo "bumped to $$NEW — edit CHANGELOG.md, then: make release CONFIRM=1"

check:
	@echo "==> check working tree"
	@test -z "$$(git status --porcelain)" || { \
	  echo "error: working tree not clean; commit or stash first" >&2; \
	  git status -sb; exit 1; \
	}
	@CUR=$$(node -p "require('./package.json').version"); \
	if [[ "$(origin VERSION)" == "command line" && "$(VERSION)" != "$$CUR" ]]; then \
	  echo "error: VERSION=$(VERSION) does not match package.json ($$CUR)" >&2; \
	  echo "  bump first: make bump VERSION=$(VERSION)" >&2; \
	  exit 1; \
	fi; \
	echo "==> on branch $(BRANCH) @ $$CUR"
	@npm run typecheck
	@npm test
	@CUR=$$(node -p "require('./package.json').version"); \
	echo "==> ensure CHANGELOG has ## $$CUR"; \
	grep -q "^## $$CUR$$" CHANGELOG.md || { \
	  echo "error: CHANGELOG.md missing '## $$CUR'" >&2; exit 1; \
	}

# Prefer NPM_TOKEN / NODE_AUTH_TOKEN when set (CI / automation tokens).
# Do not print token values.
define npm_with_token
	if [[ -n "$${NPM_TOKEN:-}" ]]; then export NODE_AUTH_TOKEN="$$NPM_TOKEN"; fi; \
	if [[ -z "$${NODE_AUTH_TOKEN:-}" ]] && [[ -n "$${NPM_CONFIG_TOKEN:-}" ]]; then \
	  export NODE_AUTH_TOKEN="$$NPM_CONFIG_TOKEN"; \
	fi
endef

npm-auth:
	@$(npm_with_token); \
	echo "==> npm whoami"; \
	if ! WHO=$$(npm whoami 2>/dev/null); then \
	  echo "error: npmjs auth failed (whoami → 401/unauthorized)" >&2; \
	  echo "" >&2; \
	  echo "  Your ~/.npmrc token is missing or expired. Fix one of:" >&2; \
	  echo "    1) Interactive:  npm login" >&2; \
	  echo "    2) Automation:   create a granular token (Publish) at" >&2; \
	  echo "                     https://www.npmjs.com/settings/~/tokens" >&2; \
	  echo "                     then:  export NPM_TOKEN=npm_…" >&2; \
	  echo "    3) Or set //registry.npmjs.org/:_authToken=… in ~/.npmrc" >&2; \
	  echo "" >&2; \
	  echo "  Then: make npm-auth && make release CONFIRM=1" >&2; \
	  exit 1; \
	fi; \
	echo "logged in as $$WHO"

npm-pack: check
	@echo "==> npm pack --dry-run"
	@$(npm_with_token); npm pack --dry-run

npm-publish: check npm-auth
	@CUR=$$(node -p "require('./package.json').version"); \
	$(npm_with_token); \
	if npm view "prompt-exporter@$$CUR" version >/dev/null 2>&1; then \
	  echo "==> prompt-exporter@$$CUR already on npmjs — skip publish"; \
	  npm view prompt-exporter version; \
	  exit 0; \
	fi; \
	echo "==> npm publish --access public ($$CUR)"; \
	npm publish --access public; \
	npm view prompt-exporter version

github-tag: check
	@CUR=$$(node -p "require('./package.json').version"); \
	TAG="v$$CUR"; \
	echo "==> ensure remote $(REMOTE) has latest $(BRANCH)"; \
	git push $(REMOTE) $(BRANCH); \
	if git rev-parse "$$TAG" >/dev/null 2>&1; then \
	  echo "tag $$TAG already exists locally"; \
	else \
	  git tag -a "$$TAG" -m "prompt-exporter $$CUR"; \
	  echo "created tag $$TAG"; \
	fi; \
	git push $(REMOTE) "$$TAG"

github-release: github-tag
	@CUR=$$(node -p "require('./package.json').version"); \
	TAG="v$$CUR"; \
	echo "==> GitHub Release $$TAG"; \
	if gh release view "$$TAG" >/dev/null 2>&1; then \
	  echo "release $$TAG already exists"; \
	else \
	  NOTES=$$(awk -v ver="$$CUR" '/^## /{if($$2==ver){p=1;next} if(p) exit} p' CHANGELOG.md); \
	  gh release create "$$TAG" \
	    --title "$$CUR" \
	    --notes "$$NOTES"; \
	fi; \
	echo "https://github.com/$(REPO)/releases/tag/$$TAG"

aur-sha:
	@CUR=$$(node -p "require('./package.json').version"); \
	TAG="v$$CUR"; \
	URL="https://github.com/$(REPO)/archive/refs/tags/$$TAG.tar.gz"; \
	echo "==> wait for GitHub tarball $$URL"; \
	for i in 1 2 3 4 5 6; do \
	  CODE=$$(curl -sL -o /tmp/pe-$$TAG.tgz -w '%{http_code}' "$$URL"); \
	  BYTES=$$(wc -c </tmp/pe-$$TAG.tgz); \
	  if [[ "$$CODE" == "200" && "$$BYTES" -gt 1000 ]]; then break; fi; \
	  echo "  attempt $$i: HTTP $$CODE bytes $$BYTES — retry"; \
	  sleep 2; \
	done; \
	SUM=$$(sha256sum /tmp/pe-$$TAG.tgz | awk '{print $$1}'); \
	echo "sha256=$$SUM"; \
	sed -i "s/^pkgver=.*/pkgver=$$CUR/" $(AUR_STABLE)/PKGBUILD; \
	sed -i "s/^pkgrel=.*/pkgrel=1/" $(AUR_STABLE)/PKGBUILD; \
	sed -i "s/sha256sums=.*/sha256sums=('$$SUM')/" $(AUR_STABLE)/PKGBUILD; \
	( cd $(AUR_STABLE) && makepkg --printsrcinfo > .SRCINFO ); \
	_r=$$(git rev-list --count HEAD); \
	_g=$$(git rev-parse --short HEAD); \
	sed -i "s/^pkgver=.*/pkgver=$$CUR.r$${_r}.g$${_g}/" $(AUR_GIT)/PKGBUILD; \
	( cd $(AUR_GIT) && makepkg --printsrcinfo > .SRCINFO ); \
	echo "updated $(AUR_STABLE) and $(AUR_GIT)"

aur-commit:
	@CUR=$$(node -p "require('./package.json').version"); \
	git add $(AUR_STABLE) $(AUR_GIT); \
	if git diff --cached --quiet; then \
	  echo "no AUR metadata changes to commit"; \
	else \
	  git commit -m "chore(aur): set sha256 for prompt-exporter $$CUR"; \
	  git push $(REMOTE) $(BRANCH); \
	fi

aur-publish:
	@echo "==> AUR SSH check"
	@ssh -o BatchMode=yes -T aur@aur.archlinux.org 2>&1 | head -3 || true
	@./aur/publish.sh prompt-exporter
	@./aur/publish.sh prompt-exporter-git

# Full ship: npm → GitHub → AUR (from GitHub tag tarball)
# Resume after a failed mid-pipeline run: SKIP_NPM=1 (if npm already ok).
release:
	@if [[ "$(CONFIRM)" != "1" ]]; then \
	  echo "Refusing to run full release without CONFIRM=1"; \
	  echo "  make bump VERSION=x.y.z   # if needed"; \
	  echo "  make release CONFIRM=1"; \
	  echo "  make release CONFIRM=1 SKIP_NPM=1   # resume past npm"; \
	  exit 1; \
	fi
	$(MAKE) check
	@if [[ "$(SKIP_NPM)" == "1" ]]; then \
	  echo "==> SKIP_NPM=1 — skipping npm-publish"; \
	else \
	  $(MAKE) npm-publish; \
	fi
	$(MAKE) github-release
	$(MAKE) aur-sha
	$(MAKE) aur-commit
	$(MAKE) aur-publish
	@CUR=$$(node -p "require('./package.json').version"); \
	echo ""; \
	echo "Released prompt-exporter $$CUR"; \
	echo "  npm:    https://www.npmjs.com/package/prompt-exporter"; \
	echo "  GitHub: https://github.com/$(REPO)/releases/tag/v$$CUR"; \
	echo "  AUR:    https://aur.archlinux.org/packages/prompt-exporter"

smoke:
	@CUR=$$(node -p "require('./package.json').version"); \
	echo "npm:  npm install -g prompt-exporter@$$CUR && prompt-exporter --version"; \
	echo "AUR:  yay -S prompt-exporter && prompt-exporter --version"; \
	echo "src:  prompt-exporter sources"
