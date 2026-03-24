# SQMU Contracts & ABI Module

This folder contains the contract-side reference implementation for SQMU.

## What is in this folder

- `Contracts/` — Solidity contracts for minting, listing/distribution, rent, escrow, trading, and governance-related flows.
- `Contracts/Escrow.sol` — non-upgradeable escrow implementation intended for minimal clones.
- `Contracts/EscrowFactory.sol` — UUPS-upgradeable factory, whitelist, and registry for escrow creation.
- `ABI/` — Versioned ABI artifacts consumed by off-chain integrations.
- `deployment_log.md` — Deployment notes and environment-specific history.
- `EscrowSources/` — escrow-only Hardhat source entrypoint used to compile and test the new escrow stack without touching unrelated contracts.

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

## Escrow Architecture

The escrow flow now uses a split model:

- `EscrowFactory` is the only upgradeable contract.
- Each `Escrow` instance is a non-upgradeable EIP-1167 clone.
- Escrows are created with fixed buyer, seller, and agent roles.
- Funding is staged as `EOI`, `Deposit`, and `Final`.
- Release and refund actions use on-chain 2-of-3 confirmations.

This reset replaces the older combined escrow/factory model that previously lived in a single Solidity file.

## Local Validation

From `SQMU/`:

```bash
npm install
npm test
npm run export:abi
```

The Hardhat workspace is intentionally scoped to escrow sources only so it can compile and test the new escrow stack without needing to normalize the rest of the contract module first.

## Licensing

- SQMU contracts in `Contracts/` are licensed under **Apache-2.0** (see SPDX headers and repository `LICENSE`).
- Imported OpenZeppelin dependencies (including upgradeable contracts) remain under their upstream **MIT** license.
