# SQMU Contracts & ABI Module

This folder contains the contract-side reference implementation for SQMU.

## What is in this folder

- `Contracts/` — Solidity contracts for minting, listing/distribution, rent, escrow, trading, and governance-related flows.
- `Contracts/Escrow.sol` — non-upgradeable escrow implementation intended for minimal clones.
- `Contracts/EscrowFactory.sol` — UUPS-upgradeable factory, whitelist, and registry for escrow creation.
- `Contracts/SQMUCrowdfund.sol` — UUPS-upgradeable governance sale contract with an owner-managed payment-token allowlist.
- `ABI/` — Versioned ABI artifacts consumed by off-chain integrations.
- `contract-bundle.config.json` — Release metadata describing deployment order, initializer schemas, and upgrade policy per contract.
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
npm run build
```

The Hardhat workspace now compiles the full `Contracts/` suite and exports ABI files for the main SQMU contracts. The current OpenZeppelin toolchain emits Cancun-era bytecode, so target chains must support Cancun-compatible EVM opcodes.

`npm run build` now also generates a release bundle in `dist/contract-bundle/` for CI publishing.

For a local deployment smoke check against Anvil:

```bash
docker run -d --rm --name sqmu-anvil ghcr.io/foundry-rs/foundry:latest anvil --host 0.0.0.0 --chain-id 31337
docker run --rm --network container:sqmu-anvil -v "$PWD:/workspace" -w /workspace/SQMU -e ANVIL_RPC_URL=http://127.0.0.1:8545 node:22.11.0-alpine sh -lc "npm run build && npm run smoke:deploy:anvil"
docker stop sqmu-anvil
```

The smoke report is written to `dist/anvil-smoke-report.json` and is intentionally ignored by git.

For a richer seeded integration run that deploys the bundle, creates a local stablecoin, bootstraps token allowlists, and executes distributor, crowdfund, trade, rent, and escrow flows:

```bash
docker run -d --rm --name sqmu-anvil ghcr.io/foundry-rs/foundry:latest anvil --host 0.0.0.0 --chain-id 31337
docker run --rm --network container:sqmu-anvil -v "$PWD:/workspace" -w /workspace/SQMU -e ANVIL_RPC_URL=http://127.0.0.1:8545 node:22.11.0-alpine sh -lc "npm run build && npm run integration:anvil"
docker stop sqmu-anvil
```

The integration report is written to `dist/anvil-integration-report.json` and can be used as a seeded reference when validating the WordPress plugin against a local chain.

## Licensing

- SQMU contracts in `Contracts/` are licensed under **Apache-2.0** (see SPDX headers and repository `LICENSE`).
- Imported OpenZeppelin dependencies (including upgradeable contracts) remain under their upstream **MIT** license.
