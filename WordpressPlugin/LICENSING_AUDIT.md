# WordpressPlugin Licensing Reference Audit

Date: 2026-03-27
Scope: `WordpressPlugin/` (tracked files only)

## Summary

I reviewed tracked files in `WordpressPlugin/` for licensing-related terms (`license`, `GPL`, `copyright`).

- **Current plugin licensing metadata appears in-use and expected** in `plugin/readme.txt`.
- **The plugin now uses MetaMask Connect EVM (`@metamask/connect-evm`) for wallet interactions, and the installed package is MIT licensed.**
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

### 4) MetaMask wallet dependency licensing assessment

The WordPress plugin currently depends on `@metamask/connect-evm` for MetaMask wallet connectivity:

- Declared in `WordpressPlugin/package.json` dependencies (`"@metamask/connect-evm": "^0.9.0"`).
- Present in lockfile as `node_modules/@metamask/connect-evm` version `0.9.0`.

The installed package metadata and license text identify it as MIT licensed:

- `WordpressPlugin/node_modules/@metamask/connect-evm/package.json` -> `"license": "MIT"`
- `WordpressPlugin/node_modules/@metamask/connect-evm/LICENSE` -> standard MIT license text

Implications for licensing audit/compliance:

1. `@metamask/connect-evm` no longer carries the non-commercial licensing concern previously noted for `@metamask/sdk`.
2. The earlier `@metamask/sdk` findings should be treated as historical context only, not the current runtime state of the plugin.
3. Standard third-party dependency review should still track version and license changes during future upgrades.

## Recommended cleanup options

If you want to reduce noise and avoid confusion for audits:

1. Keep `plugin/readme.txt` as the authoritative plugin license declaration.
2. Either:
   - move `references/wordpress/theme/masu-wpcom/` outside the production plugin tree, or
   - add a short README in `references/` explicitly stating it is historical/upstream reference content.
3. Optionally exclude `references/` from any automated “project license scan” checks if those checks are only intended to validate shipping plugin artifacts.
4. Remove any release checklist items that still assume `@metamask/sdk` is the active MetaMask runtime dependency.

## Commands used

- `git ls-files WordpressPlugin`
- `rg -n -i "license|licen[cs]e|copyright|gpl|mit|apache|bsd" WordpressPlugin --glob '!WordpressPlugin/node_modules/**'`
- `rg -n -i "license|licen[cs]e|copyright|gpl" WordpressPlugin/plugin/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/style.css WordpressPlugin/references/wordpress/theme/masu-wpcom/readme.txt WordpressPlugin/references/wordpress/theme/masu-wpcom/inc/updater.php`
- `node -e "const l=require('./WordpressPlugin/package-lock.json'); const p=l.packages['node_modules/@metamask/connect-evm']; console.log(p&&JSON.stringify({version:p.version,license:p.license,resolved:p.resolved},null,2));"`
- `sed -n '1,40p' WordpressPlugin/node_modules/@metamask/connect-evm/LICENSE`
