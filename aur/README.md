# AUR packaging

| Directory | AUR package | Source |
|-----------|-------------|--------|
| `prompt-exporter/` | [`prompt-exporter`](https://aur.archlinux.org/packages/prompt-exporter) | GitHub tag `vX.Y.Z` tarball |
| `prompt-exporter-git/` | [`prompt-exporter-git`](https://aur.archlinux.org/packages/prompt-exporter-git) | `master` |

Prefer the product **Makefile** (npm → GitHub → AUR):

```bash
make release CONFIRM=1
# or:
make aur-sha && make aur-commit && make aur-publish
```

Manual publish (after filling `sha256sums` for stable):

```bash
./aur/publish.sh prompt-exporter
./aur/publish.sh prompt-exporter-git
```
