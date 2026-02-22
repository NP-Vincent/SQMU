# Google App Script Agent Guide

## Purpose
This folder contains Google Apps Script automations that generate/send SQMU transactional email receipts
for workflows such as escrow, rent, listing, governance, and payment events.

## Owning Agent
- **GoogleAppScript Agent** (primary owner)
  - Handles communication automation and template-driven receipt dispatch.
  - Translates verified workflow data into user-facing email notifications.

## Responsibilities in this folder
- Keep each script focused on a clear workflow (`*_email_receipt.gs`).
- Keep message templates and variable mappings consistent with upstream event semantics.
- Keep operational assumptions documented (trigger source, required payload fields, recipient logic).

## Integration points
- Relies on **Contract Agent** data model consistency for transaction/event context.
- Relies on **WordPress Agent** or backend integration hooks for initiating receipt workflows where applicable.

## Change workflow
1. Confirm event/workflow and required receipt payload.
2. Update or add the targeted script with explicit field expectations.
3. Validate output content and recipient routing in test/staging setup.
4. Document dependency changes when upstream contract/plugin interfaces evolve.
