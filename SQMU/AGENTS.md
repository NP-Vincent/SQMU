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

## Contract Deployment Methodology Foundation

The SQMU contract module uses a deployment model that should remain the foundation for future work in this repository and in related projects.

### Guiding principles

1. Separate the contract release lifecycle from the application release lifecycle.
   - Contracts are compiled, tested, bundled, and published as immutable release artifacts.
   - Applications such as the WordPress plugin ship with one explicitly pinned contract bundle version.
   - The application must not deploy from an ad hoc CI artifact or from raw Solidity source at runtime.

2. Deploy from a manifest-driven contract bundle.
   - The deployment surface is driven by bundle metadata, not by hardcoded contract-specific UI logic.
   - The bundle must describe deployment order, dependencies, initializer expectations, upgradeability, and integrity metadata.
   - Future deployment tooling should stay generic enough to reuse the same deployment engine for another contract suite by changing the bundle, not by rewriting the admin flow.

3. Keep deployment wallet-signed, browser-executed, and backend-recorded.
   - A single connected administrator wallet signs and pays for each deployment and bootstrap transaction.
   - The browser/admin UI coordinates deployment sequencing, waits for confirmations, and collects deployed addresses.
   - The backend records deployment history, active deployments per chain, and bundle metadata, but does not hold deployment keys or sign transactions.

4. Treat deployment and bootstrap as separate phases.
   - Deployment creates the contracts and runs required initializers.
   - Bootstrap applies operational settings such as treasury addresses, fee configuration, inter-contract linking, and payment-token allowlists.
   - A deployed stack is not considered operationally ready until bootstrap has been completed.

5. Preserve deployment history as a first-class operational record.
   - Store deployment id, chain id, bundle version, deployer wallet, timestamps, tx hashes, proxy addresses, implementation addresses, and status.
   - Track which deployment is active for each chain instead of overwriting older deployments.
   - Use deployment history as the basis for future upgrade, rollback, and audit decisions.

6. Keep upgrade policy in the bundle metadata from the start.
   - Each contract should declare whether upgrades are allowed, the default upgrade action, and whether human review is required.
   - The admin layer should surface those policies instead of inventing upgrade rules separately.

### Reuse rule for future projects

If another project adopts this model, preserve the same sequence:

1. publish an immutable contract bundle release
2. pin one bundle version into the application package
3. deploy through a single connected wallet in the admin UI
4. persist deployment records in the backend
5. apply bootstrap configuration after deployment

This keeps deployments reproducible, auditable, and transferable across products without introducing server-side signing risk.

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
- `scripts/integration-anvil.cjs` is the richer local seeded scenario for end-to-end bundle, token, bootstrap, and core flow validation before exercising the WordPress plugin manually.
