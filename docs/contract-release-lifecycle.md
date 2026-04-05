# SQMU Contract Release And Plugin Packaging

## Goal

Keep the contract lifecycle and the WordPress plugin lifecycle separate while letting the plugin ship a pinned, auditable contract deployment bundle.

The contract pipeline verifies and publishes immutable release bundles.
The plugin pipeline chooses one pinned bundle version and includes it in the packaged plugin release.

## Single-Wallet Deployment Methodology

SQMU uses a single-wallet administrative deployment model.
This is the baseline approach that future SQMU contract work should extend rather than replace.

### Core model

The deployment system is intentionally split across three responsibilities:

1. Contract release pipeline
   - compiles, tests, and bundles the contract suite
   - publishes an immutable release asset
   - defines deployment metadata in a machine-readable manifest

2. Browser-based admin deployment console
   - loads the pinned bundle packaged with the application
   - connects to one administrator wallet
   - asks that wallet to sign each deployment and bootstrap transaction
   - executes the deployment sequence in dependency order

3. Application backend
   - exposes the pinned bundle metadata to the admin UI
   - stores deployment history and active deployment records
   - syncs deployed addresses into application settings when requested
   - never stores deployment private keys or signs on behalf of the wallet

This creates a non-custodial deployment experience with a single operational wallet while still giving the application a durable deployment record.

### Why the deployment UI is bundle-driven

The admin UI does not deploy from raw Solidity source files.
Instead, it deploys from a reviewed bundle that contains:

- a manifest
- ABI data
- deployment bytecode
- dependency order
- initializer metadata
- upgradeability metadata
- integrity information

That bundle-driven model matters because it keeps the deployment surface generic.
The UI can deploy a stack by following manifest instructions rather than by embedding contract-specific deployment logic throughout the application.

### Single-wallet execution flow

The operational sequence is:

1. The admin opens the deployment screen in the application.
2. The application confirms that a pinned contract bundle is packaged and available.
3. The admin connects one wallet and selects the target chain.
4. The browser reads the bundle manifest and computes the deployment order.
5. Each deployment transaction is signed by the connected wallet in the browser.
6. The browser waits for each receipt, captures deployed addresses, and resolves dependencies for subsequent steps.
7. When the stack is fully deployed, the application backend records the deployment.
8. The admin may then sync the active deployment into runtime settings and run bootstrap operations.

The critical point is that one wallet signs the entire sequence, but the sequence itself is coordinated by the browser and anchored by backend persistence.

### Deployment and bootstrap are separate on purpose

SQMU treats deployment and operational configuration as two distinct phases.

Deployment is responsible for:

- creating implementations and proxies
- running initializers
- resolving intra-stack dependencies
- recording the resulting addresses

Bootstrap is responsible for:

- setting treasury addresses
- setting fee or commission parameters
- linking live contracts that require owner configuration
- applying payment-token allowlists
- syncing deployed addresses into application settings

This separation keeps the deployment engine generic while allowing chain-specific or business-specific operational settings to be applied after the stack exists.

### Deployment history is part of the system design

The application must preserve deployment history instead of treating current addresses as the only source of truth.

Each deployment record should capture:

- deployment id
- chain id
- bundle/release version
- deployer wallet
- timestamp
- contract addresses
- implementation addresses where relevant
- transaction hashes
- deployment status

Active deployment tracking should then map a chain to one chosen deployment record.
Older deployments should remain available for audit, review, and rollback reasoning.

### Upgradeability decisions belong in the bundle metadata

The bundle manifest should carry the initial upgrade policy for each contract:

- whether upgrades are allowed
- whether the default action is upgrade or redeploy
- whether manual review is required
- what other deployed contracts depend on it

This lets the admin experience evolve into a structured upgrade workflow later without inventing upgrade rules outside the release process.

### Reusable pattern for another project

To reproduce this model in another project:

1. publish immutable contract bundles from CI
2. package one pinned bundle inside the application
3. build a browser admin deployment console around a single connected wallet
4. execute deployments from manifest metadata in dependency order
5. record deployment history in the backend
6. keep bootstrap configuration separate from the deployment transaction flow

That is the transferable foundation behind the SQMU approach.

## Workflows

### `contracts-ci.yml`

Runs on contract changes and verifies the SQMU contract module:

- compile
- test
- ABI export
- contract bundle preview generation
- local-chain smoke deployment to Anvil using the generated bundle

Its uploaded artifact is only a CI preview.
It is useful for validation, but it is not the long-lived source of truth for plugin packaging.

### `contracts-release.yml`

Runs on `contracts-v*` tags or manual dispatch and publishes an immutable contract bundle as a GitHub Release asset.

Each release produces:

- `sqmu-contract-bundle-<version>.zip`
- `sqmu-contract-bundle-<version>.zip.sha256`

This release asset is the durable contract bundle that the WordPress plugin can pin to.

### `wpcom.yml`

Builds and stages the WordPress plugin.

It reads the tracked pin file at [WordpressPlugin/contract-bundle.json](/Users/alfred/Documents/GitHub/SQMU/WordpressPlugin/contract-bundle.json).

If the pin is enabled, the workflow:

- downloads the exact contract bundle release asset
- verifies its SHA-256 checksum
- stages it into `sqmu/contracts/current/` inside the packaged plugin

If the pin is disabled, the plugin release is built without bundling contracts.

## Bundle Structure

The generated contract bundle is built from [SQMU/contract-bundle.config.json](/Users/alfred/Documents/GitHub/SQMU/SQMU/contract-bundle.config.json) and [SQMU/scripts/build-contract-bundle.cjs](/Users/alfred/Documents/GitHub/SQMU/SQMU/scripts/build-contract-bundle.cjs).

The zip contains:

- `manifest.json`
- `contracts/<ContractName>.json`
- `abi/<ContractName>.json`

`manifest.json` records:

- schema version
- release track
- release version
- generation timestamp
- git commit
- solc version
- EVM target
- per-contract deployment metadata
- per-contract upgrade metadata
- per-contract SHA-256 integrity hashes

Each `contracts/<ContractName>.json` file includes:

- ABI
- deployment bytecode
- deployed bytecode
- source name
- link references

## Pinned Version Tracking

The tracked pin file is [WordpressPlugin/contract-bundle.json](/Users/alfred/Documents/GitHub/SQMU/WordpressPlugin/contract-bundle.json).

This file is intentionally small and auditable.
When `contracts-release.yml` succeeds, it now updates this file automatically on `main` with the exact bundle version, asset name, and SHA-256 checksum that were just published.

Suggested update flow:

1. Contract code changes land in `SQMU/`
2. `contracts-ci.yml` validates the changes
3. A maintainer publishes a `contracts-vX.Y.Z` release
4. `contracts-release.yml` updates `WordpressPlugin/contract-bundle.json` on `main`
5. The plugin release workflow packages that exact bundle version

This means contract changes do not automatically force a plugin deployment.

## Public vs Local Boundaries

The repository should clearly separate public, reproducible inputs from local machine state.

### Public and tracked

- Solidity source in `SQMU/Contracts`
- tests in `SQMU/test`
- contract bundle schema in `SQMU/contract-bundle.config.json`
- build and release workflows in `.github/workflows/`
- the plugin pin file in `WordpressPlugin/contract-bundle.json`
- documentation describing release and deployment policy

### Public but generated in CI

- GitHub Release assets for contract bundles
- CI preview artifacts
- CI-generated Anvil smoke reports

These are safe to publish because they contain compiled bytecode, ABI, and test-chain deployment metadata only.
They must not contain secrets or real production deployment keys.

### Local-only and ignored

- `SQMU/dist/`
- local Hardhat artifacts and cache
- any manually run smoke deployment reports
- temporary Anvil state

These are development-machine outputs and should not be committed.

### Never commit

- production private keys
- paid RPC credentials
- environment files containing secrets
- live deployment signing material

The Anvil smoke deployment uses only an ephemeral local chain and the standard Anvil test key.
That is acceptable in a public repo because it is strictly non-production and deterministic.

## WordPress Deployment Data Model

The future one-click deployment feature should track deployment history separately from the pinned bundle.

Recommended WordPress option model:

- `sqmu_contract_bundle_pin`
  - the currently packaged bundle metadata mirrored from `contract-bundle.json`
- `sqmu_contract_deployments`
  - full deployment history keyed by deployment id
- `sqmu_contract_active_deployments`
  - chain id -> active deployment id

Recommended deployment record shape:

- `deploymentId`
- `chainId`
- `releaseVersion`
- `manifestSha256`
- `deployedAt`
- `deployerWallet`
- `status`
  - `draft`
  - `active`
  - `superseded`
  - `failed`
- `contracts`
  - proxy address
  - implementation address
  - tx hash
  - deployment kind

This keeps old addresses and deployment versions available for audit and rollback reasoning.

## Upgrade Decision Model

The contract bundle manifest should drive the WordPress admin decision surface.

Per contract, the bundle metadata already records:

- whether upgrades are allowed
- the default action
- whether manual review is required
- deployment dependencies

That should map to three WordPress admin choices:

1. `Upgrade In Place`
   - for compatible proxy-based upgrades
2. `Deploy New Stack`
   - for incompatible upgrades or fresh environments
3. `Manual Migration Required`
   - for changes that should not be one-click automated

## Suggested Admin UI States

Recommended future admin states for the deployment screen:

### No pinned bundle

- Show that the plugin was packaged without a contract bundle
- Block one-click deployment

### Pinned bundle available, no deployments

- Show bundle version and chain selector
- Offer `Deploy Contracts`

### Active deployment current

- Show active deployment addresses and release version
- Offer `Redeploy` as an explicit advanced action

### Newer bundle pinned than active deployment

- Compare active deployment release vs pinned release
- Show `Upgrade`, `Deploy New`, or `Manual Migration Required`

### Deployment history

- Show all deployments by chain
- Preserve older address sets and tx hashes
- Allow marking an older deployment set as the active reference if needed

## Rationale

This split model avoids three common problems:

- plugin releases accidentally drifting with unreviewed contract changes
- expiring CI artifacts becoming a hidden runtime dependency
- live deployments losing their version lineage after upgrades

The result is a cleaner lifecycle:

- contract CI proves correctness
- contract releases publish immutable bundles
- plugin releases pin one exact bundle
- WordPress tracks what was actually deployed per chain
