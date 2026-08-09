This repository is a deployment wrapper around a pinned `cloudflare/cloudflare-os` release (see README.md): it adds branding, identity, routing, and integration customizations without patching the upstream source, and pins that source via the `cloudflare-os` git submodule.

## Fork / upstream workflow (this checkout)

This local checkout is a fork of `cloudflare/cloudflare-os-starter`, set up to track upstream while keeping custom changes separate:

- `origin` remote → `b-als/cloudflare-os-starter` (this fork; push custom work here).
- `upstream` remote → `cloudflare/cloudflare-os-starter` (read-only; never push here).
- `main` branch → kept pristine, always mirrors `upstream/main`. Do not commit custom changes on `main`.
- `custom` branch → where all custom changes live and get committed/pushed. Work here by default.

The nested `cloudflare-os` submodule follows the same fork/upstream remote convention (`origin` = `b-als/cloudflare-os`, `upstream` = `cloudflare/cloudflare-os`); it stays pinned to a specific commit rather than a branch, per normal submodule usage.

To pull in upstream updates without losing customizations:
```
git fetch upstream
git checkout main && git reset --hard upstream/main
git checkout custom && git merge main   # resolve conflicts here
git push origin custom
```
