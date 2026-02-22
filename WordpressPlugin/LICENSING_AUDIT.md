# WordpressPlugin Licensing Reference Audit

Date: 2026-02-22
Scope: `WordpressPlugin/` (tracked files only)

## Summary

I reviewed tracked files in `WordpressPlugin/` for licensing-related terms (`license`, `GPL`, `copyright`).

- **Current plugin licensing metadata appears in-use and expected** in `plugin/readme.txt`.
- **MetaMask SDK (`@metamask/sdk`) is in active runtime use for wallet interactions and must be tracked as a third-party licensing exception/risk item.**
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

### 4) MetaMask SDK licensing assessment (action required)

The WordPress plugin currently depends on `@metamask/sdk` for wallet connectivity:

- Declared in `WordpressPlugin/package.json` dependencies (`"@metamask/sdk": "^0.30.1"`).
- Present in lockfile as `node_modules/@metamask/sdk` version `0.30.3`.

However, the installed package license text (`WordpressPlugin/node_modules/@metamask/sdk/LICENSE`) is **not a standard permissive OSS license** and includes a **Non-Commercial Use** restriction and additional usage constraints.

Implications for licensing audit/compliance:

1. Treat `@metamask/sdk` as a **flagged third-party license dependency** requiring legal review before commercial distribution/use.
2. Do not assume npm metadata defaults (or absent lockfile `license` fields) imply MIT/Apache compatibility.
3. Track this package in release checklists with one of the following dispositions:
   - approved usage under specific business constraints,
   - replacement with an alternative wallet integration under a commercial-compatible license,
   - direct licensing arrangement/clarification with MetaMask/ConsenSys.

## Recommended cleanup options

If you want to reduce noise and avoid confusion for audits:

1. Keep `plugin/readme.txt` as the authoritative plugin license declaration.
2. Either:
   - move `references/wordpress/theme/masu-wpcom/` outside the production plugin tree, or
   - add a short README in `references/` explicitly stating it is historical/upstream reference content.
3. Optionally exclude `references/` from any automated “project license scan” checks if those checks are only intended to validate shipping plugin artifacts.
4. Add an explicit compliance gate for `@metamask/sdk` license review in WordPress plugin release workflows.

## Commands used

- `git ls-files WordpressPlugin`
- `rg -n -i "license|licen[cs]e|copyright|gpl|mit|apache|bsd" WordpressPlugin --glob '!WordpressPlugin/node_modules/**'`
- `rg -n -i "license|licen[cs]e|copyright|gpl" WordpressPlugin/plugin/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/style.css WordpressPlugin/references/wordpress/theme/masu-wpcom/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/inc/updater.php`
- `node -e "const l=require('./WordpressPlugin/package-lock.json'); const p=l.packages['node_modules/@metamask/sdk']; console.log(p&&JSON.stringify({version:p.version,license:p.license,resolved:p.resolved},null,2));"`
- `sed -n '1,40p' WordpressPlugin/node_modules/@metamask/sdk/LICENSE`
