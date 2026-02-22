# SQMU Contracts & ABI Module

This folder contains the contract-side reference implementation for SQMU.

## What is in this folder

- `Contracts/` — Solidity contracts for minting, listing/distribution, rent, escrow, trading, and governance-related flows.
- `ABI/` — Versioned ABI artifacts consumed by off-chain integrations.
- `deployment_log.md` — Deployment notes and environment-specific history.

## Ownership and responsibilities

This module is owned by the **Contract Agent**.

Primary responsibilities:
- Maintain contract interfaces and event semantics used by downstream systems.
- Keep ABI artifacts aligned with deployed contract versions.
- Document integration-impacting changes for WordPress and automation consumers.

## Integration dependencies

- `WordpressPlugin/` uses contract ABIs, deployed addresses, and event semantics for wallet-connected UI flows.
- `GoogleAppScript/` relies on verified workflow payloads derived from contract activity for transactional receipts.

## Change checklist

1. Identify impacted contract workflows and interfaces.
2. Update Solidity contracts.
3. Regenerate/update ABIs.
4. Document migration or compatibility notes.
5. Validate in staging before production deployment.
