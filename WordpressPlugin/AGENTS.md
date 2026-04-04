# WordPress Plugin Agent Guide

## Purpose

This folder is the WordPress-owned integration layer for the current SQMU contract set.
It maps shortcode-rendered React views to on-chain wallet operations while keeping
WordPress-specific behavior inside plugin PHP code and wp-admin settings.

## Owning Agent

- **WordPress Agent** (primary owner)
  - Exposes public and administrator interaction points in WordPress.
  - Connects wallet UI actions to current contract ABIs and deployed addresses.

## Responsibilities In This Folder

- Keep the public shortcode surfaces stable:
  - `[sqmu_app view="..." property_code="..." escrow_address="..."]`
  - `[sqmu_payment]`
- Keep React + Wagmi wallet logic isolated inside the browser bundle
- Keep WordPress-specific routing and config assembly in PHP/plugin boundaries
- Maintain the normalized runtime config contract assembled from plugin settings
- Maintain the admin settings UI for chains, contracts, payment tokens, and per-view defaults
  It should stay field-driven in wp-admin rather than raw JSON textareas.
- Maintain the restricted admin operations page for browser-signed owner/admin actions
- Maintain the read-only deployment console that surfaces the pinned bundle, bundled manifest metadata, and recorded deployment history
- Resolve property-specific details from WordPress post meta using the fixed SQMU meta keys
  Property-bound views should auto-discover from the current WordPress post first, then fall back to `[data-sqmu-property-code]`, Estatik DOM markup, and `?code=...` when needed.
- Track dependencies on contract ABI and interface changes
- Keep build output and plugin enqueue paths aligned at `plugin/assets/sqmu.js`
- Keep generated runtime chunks in `plugin/assets/chunks/` packaged with the plugin
- Keep the tracked contract bundle pin in `contract-bundle.json` aligned with the plugin release that should ship deployment support
- Treat contract bundle release assets as immutable inputs from the contract pipeline, not as artifacts the plugin builds for itself
- Maintain two WordPress validation lanes:
  - flexible beta-image local development
  - stable WordPress + PHP 8.3 release-parity validation before signoff

## Current Runtime Model

- Frontend stack: React + Wagmi + Viem + TanStack Query
- Runtime model: direct browser-to-chain reads and writes
- Packaging model: WordPress serves `plugin/assets/sqmu.js` as an ES module plus generated `plugin/assets/chunks/*.js`; Node is build-time only
- Wallet target: MetaMask first, with generic injected EVM wallet support
- WordPress integration surface: shortcode mounts plus a restricted wp-admin operations page
- Configuration model: admin-driven, not page-authored JSON
- Consulting payment model: direct ERC-20 wallet-to-wallet transfer plus receipt webhook and Calendly redirect

## Public Views

- `buy`
  - Primary distributor purchase flow
- `portfolio`
  - SQMU holdings, secondary-market browsing, buy-from-listing, and create-listing
- `crowdfund`
  - Governance purchase flow against `SQMUCrowdfund`
- `rent`
  - Tenant/property rent actions against `SQMURent`
- `rent_distribution`
  - Read-only rent balance visibility against `SQMURentDistribution`
- `escrow`
  - Escrow create/manage flow against `EscrowFactory` and `Escrow`

## Shortcode Contract

- Public shortcode:
  - `[sqmu_app view="buy|portfolio|crowdfund|rent|rent_distribution|escrow" property_code="OPTIONAL_CODE" escrow_address="OPTIONAL_ADDRESS"]`
- Public shortcode:
  - `[sqmu_payment]`
- `view` selects the workflow
- `property_code` is the explicit override when a page should force one property
- `escrow_address` is only for loading an existing escrow instance in `view="escrow"`
- Site operators configure chains, contracts, and tokens in wp-admin rather than in page content
- On Estatik property pages, property-bound views should usually work without `property_code`
- `sqmu_payment` uses a dedicated consulting payment profile in wp-admin instead of contract view settings

## wp-admin Surfaces

- `Settings > SQMU App`
  - Source of truth for chains, contracts, payment tokens, consulting payment configuration, and per-view defaults
- `Settings > SQMU Operations`
  - Restricted administrator page
  - Uses the same frontend bundle
  - Signs owner/admin actions in the browser wallet
  - Must not expose upgrade or ownership-transfer actions
- `Settings > SQMU Deployments`
  - Restricted administrator page
  - Mirrors the packaged contract bundle pin and bundled manifest visibility
  - Shows deployment order, upgradeability metadata, and recorded deployment history
  - Uses the same frontend bundle for browser-signed fresh deploys
  - May save deployment records and optionally sync the active addresses into main plugin settings
  - Must not attempt in-place upgrades in this phase

## Deployment Storage

- `sqmu_contract_bundle_pin`
  - mirrored copy of the packaged `contract-bundle.json`
- `sqmu_contract_deployments`
  - full deployment history keyed by deployment id
- `sqmu_contract_active_deployments`
  - chain id -> active deployment id

Expected deployment record fields:

- `deploymentId`
- `chainId`
- `releaseVersion`
- `manifestVersion`
- `manifestSha256`
- `deployedAt`
- `deployerWallet`
- `status`
- `contracts`
- `txHashes`

## Contract Integration Surface

This plugin currently targets these repository contracts:

- `AtomicSQMUDistributor`
- `SQMUTrade`
- `SQMU`
- `SQMUCrowdfund`
- `SQMURent`
- `SQMURentDistribution`
- `Escrow`
- `EscrowFactory`

Excluded from the wp-admin operations surface:

- `upgradeToAndCall`
- `transferOwnership`
- `setImplementation`

## Fixed Property Meta Keys

- `_sqmu_property_code`
- `_sqmu_token_id`
- `_sqmu_token_address`
- `_sqmu_property_id`
- `_sqmu_property_ref`

View expectations:

- `buy` and `portfolio` use token metadata
- `rent` and `rent_distribution` use `_sqmu_property_id`
- `escrow` uses `_sqmu_property_ref` for property-bound creation defaults
- When property discovery succeeds, the widget should lock to that one property instead of offering cross-property switching on the same page

## Change Workflow

1. Map the user journey to one of the supported public or admin views.
2. Confirm required contract methods/events and the exact WordPress config/meta needed.
3. Implement frontend + plugin changes with a clean PHP/bundle separation.
4. Validate PHP syntax and Node/build packaging first.
5. Validate in WordPress staging with wallet flows after bundle verification.
6. Document shortcode, settings, meta, and ABI-surface changes in this folder.
