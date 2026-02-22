# Google Apps Script Licensing Reference Audit

Date: 2026-02-22
Scope: `GoogleAppScript/` (tracked files only)

## Summary

I reviewed tracked files in `GoogleAppScript/` for licensing-related declarations, third-party code usage indicators, and platform dependency assumptions for Google Apps Script deployment/distribution.

- **No per-file SPDX headers are currently present in the `*.gs` scripts.**
- **Module-level repository licensing is Apache-2.0 at the root (`LICENSE` + `NOTICE.md`), but `GoogleAppScript/README.md` does not currently restate module-specific licensing.**
- **No third-party libraries/snippets were identified in tracked script source; scripts rely on Google Apps Script built-in services (`MailApp`, `ContentService`).**
- **Distribution/operation assumes execution within Google Apps Script under Google platform terms and quotas.**

## Findings

### 1) First-party license declaration status

Reviewed script files:

- `GoogleAppScript/listing_email_receipt.gs`
- `GoogleAppScript/payment_email_receipt.gs`
- `GoogleAppScript/rent_email_receipt.gs`
- `GoogleAppScript/escrow_email_receipt.gs`
- `GoogleAppScript/governance_email_receipt.gs`

Current state:

- Scripts begin with workflow comments and `doPost(e)` handlers, but do not include explicit SPDX/license headers.
- Repository-level license/notice artifacts are present at root:
  - `LICENSE` (Apache License 2.0 text)
  - `NOTICE.md` (project attribution + Apache 2.0 reference)

Interpretation:

- A module-level licensing position exists via repository artifacts, but `GoogleAppScript/` can be made more explicit by adding a short licensing section to `GoogleAppScript/README.md` and/or SPDX headers in `.gs` files.

### 2) Third-party code/snippet usage in scripts

Checked for common indicators such as external imports, package requires, copied library markers, or third-party references.

Result:

- No third-party package imports, CDN references, `require(...)`, or external library wiring were found in the tracked `.gs` scripts.
- Script behavior is implemented with native Google Apps Script globals (`MailApp`, `ContentService`) and simple parameter parsing.

Interpretation:

- There is no evidence in this module of vendored third-party source code requiring additional in-module attribution notices at this time.
- If snippets are added later from external sources, attribution and license compatibility should be captured in-module (README note or dedicated THIRD_PARTY_NOTICES section/file).

### 3) Google platform terms/dependency assumptions

Operational dependencies observed:

- Web app style HTTP entrypoint via `doPost(e)`.
- Use of Google Apps Script runtime-provided services for mail dispatch/output formatting.

Assumptions for distribution/use:

1. Deployers run these scripts in a Google account/workspace context and accept applicable Google Apps Script and related Google service terms.
2. Sending behavior is constrained by Google Apps Script/Gmail quotas, anti-abuse policies, and account permissions.
3. Any personal data handled in payload fields (`to_email`, transaction references, amounts, property metadata) is governed by deployer privacy/compliance obligations in their jurisdiction and policy stack.
4. This module does not itself bundle Google client libraries; it depends on platform-hosted built-ins available in the Apps Script environment.

## Recommended housekeeping (lightweight)

1. Add a concise licensing section to `GoogleAppScript/README.md` that mirrors repository-level Apache-2.0 positioning.
2. Optionally add `// SPDX-License-Identifier: Apache-2.0` headers to each `*.gs` script for per-file clarity.
3. Keep a short note in module docs that execution depends on Google Apps Script platform terms/quotas and account-level mail permissions.
4. Re-run this lightweight audit when scripts start importing external APIs/snippets or when distribution model changes.

## Commands used

- `git ls-files GoogleAppScript`
- `rg -n "MailApp|ContentService|doPost|SPDX-License-Identifier|license|import |require\(" GoogleAppScript/*.gs -S`
- `sed -n '1,220p' LICENSE`
- `sed -n '1,220p' NOTICE.md`
- `sed -n '1,220p' GoogleAppScript/README.md`
