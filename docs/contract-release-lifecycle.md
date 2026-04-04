# SQMU Contract Release And Plugin Packaging

## Goal

Keep the contract lifecycle and the WordPress plugin lifecycle separate while letting the plugin ship a pinned, auditable contract deployment bundle.

The contract pipeline verifies and publishes immutable release bundles.
The plugin pipeline chooses one pinned bundle version and includes it in the packaged plugin release.

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
