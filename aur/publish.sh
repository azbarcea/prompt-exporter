#!/usr/bin/env bash
# Publish prompt-exporter-git to the AUR.
set -euo pipefail

# Prerequisites:
#   - Updates pushed to https://github.com/azbarcea/prompt-exporter
#   - SSH access to aur.archlinux.org

WORKDIR="${TMPDIR:-/tmp}/aur-prompt-exporter-git"
rm -rf "$WORKDIR"
git clone ssh://aur@aur.archlinux.org/prompt-exporter-git.git "$WORKDIR" || {
  mkdir -p "$WORKDIR"
  git -C "$WORKDIR" init
  git -C "$WORKDIR" remote add origin ssh://aur@aur.archlinux.org/prompt-exporter-git.git
}

cp PKGBUILD .SRCINFO "$WORKDIR/"
cd "$WORKDIR"
git add PKGBUILD .SRCINFO
git commit -m "prompt-exporter-git: update packaging"
git push -u origin master
echo "Published: https://aur.archlinux.org/packages/prompt-exporter-git"
