# WordPress Plugin Agent Guide

## Purpose
This folder provides the WordPress integration layer for SQMU wallet and asset workflows.
It maps shortcode-rendered React views to on-chain wallet operations while keeping WordPress-specific behavior inside plugin PHP code and wp-admin settings.

## Owning Agent
- **WordPress Agent** (primary owner)
  - Exposes administrator and end-user interaction points in WordPress.
  - Connects wallet actions and UI events to contract methods/events.

## Responsibilities in this folder
- Keep the primary shortcode mount stable: `[sqmu_app view="..." property_code="..."]`.
- Keep React + Wagmi wallet logic isolated inside the browser bundle.
- Keep WordPress-specific routing/configuration in PHP/plugin boundaries.
- Maintain the normalized runtime config contract assembled from plugin admin settings.
- Maintain the admin settings UI for chains, contracts, payment tokens, and per-view defaults.
- Resolve property-specific details from WordPress post meta using the fixed SQMU meta keys.
- Track dependencies on contract ABI/event changes and version notes.
- Keep build output and plugin enqueue paths aligned (`plugin/assets/sqmu.js`).

## Integration points
- Depends on **Contract Agent** outputs (deployed addresses, ABI compatibility, event semantics).
- Can trigger/support **GoogleAppScript Agent** communication workflows via backend hooks for receipts or notifications, but off-chain workflows must stay separate from wallet-core architecture.

## Current architecture expectations
- Frontend stack: React + Wagmi + Viem + TanStack Query.
- Runtime model: direct browser-to-chain reads and writes; no WordPress REST proxy in v1.
- Packaging model: WordPress serves compiled static assets only; Node is build-time only.
- Wallet target: MetaMask first, but connector design must remain generic-injected-wallet ready.
- WordPress integration surface: shortcodes only in v1; Gutenberg blocks are deferred.
- Configuration model: admin-driven, not page-authored JSON.

## Shortcode contract
- Primary shortcode:
  - `[sqmu_app view="buy|listing|portfolio" property_code="OPTIONAL_CODE"]`
- `view` selects the frontend view.
- `property_code` is the explicit page-level property target when a page is tied to one property.
- Site operators configure chains/contracts/tokens in wp-admin rather than in shortcode content.
- The frontend expects normalized config keys for:
  - `app`
  - `chains`
  - `defaultChainId`
  - `contracts`
  - `paymentTokens`
  - `properties`
  - `features`
- Fixed property meta keys:
  - `_sqmu_property_code`
  - `_sqmu_token_id`
  - `_sqmu_token_address`

## Change workflow
1. Map user journey and identify shortcode/widget touchpoints.
2. Confirm required contract methods/events, admin settings fields, and property meta usage.
3. Implement frontend + plugin changes with clear PHP/bundle separation.
4. Validate Node/build packaging first, then validate in a WordPress staging environment with wallet flows.
5. Document shortcode/config changes and integration/version updates.
