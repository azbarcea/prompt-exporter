#!/usr/bin/env bash
# Publish an AUR package from aur/<name>/.
# Usage: ./aur/publish.sh [prompt-exporter|prompt-exporter-git]
set -euo pipefail

PKG="${1:-prompt-exporter}"
case "$PKG" in
  prompt-exporter|prompt-exporter-git) ;;
  *) echo "Usage: $0 [prompt-exporter|prompt-exporter-git]" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${ROOT}/${PKG}"
if [[ ! -f "${SRC}/PKGBUILD" ]]; then
  echo "Missing ${SRC}/PKGBUILD" >&2
  exit 1
fi

# Prerequisites:
#   - Tag/release pushed to https://github.com/azbarcea/prompt-exporter (for stable)
#   - SSH access to aur.archlinux.org
#   - For stable: sha256sums filled (not SKIP)

if grep -q "sha256sums=('SKIP')" "${SRC}/PKGBUILD" && [[ "$PKG" == "prompt-exporter" ]]; then
  echo "Refusing to publish stable package with sha256sums=('SKIP')." >&2
  echo "Download the v* tarball, run sha256sum, update PKGBUILD + .SRCINFO first." >&2
  exit 1
fi

WORKDIR="${TMPDIR:-/tmp}/aur-${PKG}"
rm -rf "$WORKDIR"
git clone "ssh://aur@aur.archlinux.org/${PKG}.git" "$WORKDIR" || {
  mkdir -p "$WORKDIR"
  git -C "$WORKDIR" init
  git -C "$WORKDIR" remote add origin "ssh://aur@aur.archlinux.org/${PKG}.git"
}

cp "${SRC}/PKGBUILD" "${SRC}/.SRCINFO" "$WORKDIR/"
cd "$WORKDIR"
git add PKGBUILD .SRCINFO
git commit -m "${PKG}: ${PKG} $(sed -n 's/^pkgver=//p' PKGBUILD | head -1)"
git push -u origin master
echo "Published: https://aur.archlinux.org/packages/${PKG}"
