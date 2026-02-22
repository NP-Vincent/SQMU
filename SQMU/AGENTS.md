# SQMU Contracts & ABI Agent Guide

## Purpose
This folder contains the on-chain layer for SQMU:
- Solidity contracts in `Contracts/`.
- Versioned ABI artifacts in `ABI/` used by off-chain clients.
- Deployment notes in `deployment_log.md`.

The goal is to document contract-facing workflows so contributors can reason about integration without reading every contract first.

## Owning Agent
- **Contract Agent** (primary owner)
  - Maintains deploy/upgrade strategy and authoritative deployed addresses.
  - Defines contract event and method interfaces expected by external consumers.

## Responsibilities in this folder
- Keep contract workflows modular (minting, listing, rent, trade, escrow, distributions).
- Keep ABIs aligned with deployed contract versions and documented changes.
- Preserve event naming and method compatibility where possible for downstream consumers.

## Integration points
- **WordPress Agent** consumes ABI and addresses to power wallet-connected UI flows.
- **GoogleAppScript Agent** consumes emitted on-chain activity via webhook/backend mediation for transactional email receipts.

## Change workflow
1. Identify impacted contract(s) and the owning business flow.
2. Document method/event changes and migration considerations.
3. Regenerate/update ABI artifacts for changed contracts.
4. Update integration notes consumed by plugin and automation layers.
5. Validate staging before production deployment.
