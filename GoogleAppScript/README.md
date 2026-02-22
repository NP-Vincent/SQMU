# Google Apps Script Receipt Automation

This folder contains Google Apps Script automation used for SQMU transactional email receipts.

## What is in this folder

Each script targets a specific workflow:
- `listing_email_receipt.gs`
- `payment_email_receipt.gs`
- `rent_email_receipt.gs`
- `escrow_email_receipt.gs`
- `governance_email_receipt.gs`

## Ownership and responsibilities

This module is owned by the **GoogleAppScript Agent**.

Primary responsibilities:
- Keep each script scoped to a clear workflow.
- Maintain template and payload-field consistency with upstream events.
- Document assumptions about trigger source and recipient routing.

## Integration dependencies

- Depends on transaction/workflow data shaped by contract interfaces in `SQMU/`.
- Commonly triggered by WordPress/backend hooks originating from `WordpressPlugin/` integrations.

## Change checklist

1. Confirm workflow and required payload fields.
2. Update the corresponding `*_email_receipt.gs` script.
3. Validate message output and recipient routing in test/staging.
4. Note any upstream interface dependency changes.
