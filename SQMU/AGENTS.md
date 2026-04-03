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
- Keep the full contract build reproducible so deployment artifacts and ABI exports stay aligned.

## Integration points
- **WordPress Agent** consumes ABI and addresses to power wallet-connected UI flows.
- **GoogleAppScript Agent** consumes emitted on-chain activity via webhook/backend mediation for transactional email receipts.

## Change workflow
1. Identify impacted contract(s) and the owning business flow.
2. Document method/event changes and migration considerations.
3. Regenerate/update ABI artifacts for changed contracts.
4. Update integration notes consumed by plugin and automation layers.
5. Validate staging before production deployment.

## Escrow Notes

- `Contracts/Escrow.sol` is the clone target and is intentionally non-upgradeable.
- `Contracts/EscrowFactory.sol` is the UUPS-upgradeable creation/registry surface.
- `Contracts/SQMUCrowdfund.sol` now uses an owner-managed payment-token allowlist instead of Scroll-specific hardcoded stablecoins.
- `hardhat.config.cjs` compiles the full `Contracts/` suite with a Cancun EVM target to match the installed OpenZeppelin package set.
- `test/EscrowFactory.test.cjs` is the escrow regression suite.
- `test/SQMUCrowdfund.test.cjs` covers the crowdfund proxy initialization and payment-token allowlist behavior.
- `scripts/export-abis.cjs` writes the simplified ABI files consumed downstream.
- `scripts/build-contract-bundle.cjs` produces the release bundle consumed by plugin packaging and future one-click deployments.
- `scripts/smoke-deploy-anvil.cjs` validates that the generated bundle can deploy the current SQMU stack onto an ephemeral local Anvil chain.
