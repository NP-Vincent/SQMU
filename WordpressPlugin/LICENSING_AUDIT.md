# WordpressPlugin Licensing Reference Audit

Date: 2026-02-22
Scope: `WordpressPlugin/` (tracked files only)

## Summary

I reviewed tracked files in `WordpressPlugin/` for licensing-related terms (`license`, `GPL`, `copyright`).

- **Current plugin licensing metadata appears in-use and expected** in `plugin/readme.txt`.
- **Most older/redundant licensing references are in the `references/` subtree**, which appears to be upstream WordPress theme reference material rather than active plugin runtime code.
- Dependency license fields in `package-lock.json` are expected npm metadata and not redundant project-level licensing statements.

## Findings

### 1) Active plugin licensing (expected)

- `WordpressPlugin/plugin/readme.txt` contains the plugin license declaration:
  - `License: GPLv2 or later`
  - `License URI: https://www.gnu.org/licenses/gpl-2.0.html`

These are standard WordPress plugin metadata fields and should remain.

### 2) Older licensing references in vendored reference theme content

The following files in `WordpressPlugin/references/wordpress/theme/masu-wpcom/` contain legacy licensing text and/or historical changelog entries about licensing:

- `style.css` (theme header license fields)
- `inc/updater.php` (GPL header block)
- `readme.txt` (very large historical changelog with many old license/copyright mentions)

Because these are under `references/`, they are likely historical/sample assets and not the plugin's primary legal metadata.

### 3) Dependency metadata

- `WordpressPlugin/package-lock.json` contains per-package `license` values. This is normal lockfile metadata and not a duplicate top-level project license policy.

## Recommended cleanup options

If you want to reduce noise and avoid confusion for audits:

1. Keep `plugin/readme.txt` as the authoritative plugin license declaration.
2. Either:
   - move `references/wordpress/theme/masu-wpcom/` outside the production plugin tree, or
   - add a short README in `references/` explicitly stating it is historical/upstream reference content.
3. Optionally exclude `references/` from any automated “project license scan” checks if those checks are only intended to validate shipping plugin artifacts.

## Commands used

- `git ls-files WordpressPlugin`
- `rg -n -i "license|licen[cs]e|copyright|gpl|mit|apache|bsd" WordpressPlugin --glob '!WordpressPlugin/node_modules/**'`
- `rg -n -i "license|licen[cs]e|copyright|gpl" WordpressPlugin/plugin/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/style.css WordpressPlugin/references/wordpress/theme/masu-wpcom/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/inc/updater.php`
