# SQMU WordPress Plugin

## Purpose

This folder contains the WordPress integration layer for the current SQMU contract set.
It serves a compiled React + Wagmi module build through a PHP plugin, keeps runtime
configuration in wp-admin, and uses dedicated shortcodes to place contract views and payment flows into page content.

The plugin is designed so that:

- site operators configure chains, contract addresses, payment tokens, and consulting payment settings once in wp-admin
- content editors place small shortcode mounts instead of pasting JSON config per page
- property-specific pages resolve their on-chain identifiers from WordPress post meta
- wallet signing happens in the browser, not on the WordPress server

## Architecture

WordPress owns:

- shortcode registration
- asset enqueueing
- admin settings
- property lookup from WordPress post meta
- normalized runtime config injection
- the restricted admin operations page

React + Wagmi owns:

- wallet connection
- chain switching
- contract reads and writes
- public user flows
- browser-signed admin operations

Runtime is direct browser-to-chain. WordPress is not used as a REST proxy in this version.

## Shortcodes

The plugin exposes two public shortcodes:

```text
[sqmu_app view="buy|portfolio|crowdfund|rent|rent_distribution|escrow" property_code="OPTIONAL_CODE" escrow_address="OPTIONAL_ADDRESS"]
[sqmu_payment]
```

### Attributes

- `view`
  - Selects the frontend workflow.
  - Allowed values: `buy`, `portfolio`, `crowdfund`, `rent`, `rent_distribution`, `escrow`
- `property_code`
  - Optional in general.
  - Acts as the highest-priority manual override when you want to force a specific property.
  - On Estatik property pages, you can usually omit it and let the plugin auto-discover the property from the current WordPress post.
- `escrow_address`
  - Only used for `view="escrow"`.
  - If provided, the escrow view opens an existing escrow instance.
  - If omitted, the escrow view renders the create-escrow flow against `EscrowFactory`.

### View meanings

- `buy`
  - Primary purchase flow from `AtomicSQMUDistributor`
- `portfolio`
  - SQMU holdings, marketplace listings, buy-from-listing flow, and create-listing flow
- `crowdfund`
  - Governance token purchase flow from `SQMUCrowdfund`
- `rent`
  - Tenant/property rent actions from `SQMURent`
- `rent_distribution`
  - Read-only per-property rent balances from `SQMURentDistribution`
- `escrow`
  - Create or manage escrows using `EscrowFactory` and `Escrow`

### Consulting payment shortcode

- `[sqmu_payment]`
  - Renders the consulting-payment widget used for direct stablecoin payments
  - Uses the dedicated consulting payment profile from wp-admin
  - Requires email, sends a receipt webhook after confirmed payment, and redirects to Calendly

### Examples

Generic buy page:

```text
[sqmu_app view="buy"]
```

Property-specific portfolio page:

```text
[sqmu_app view="portfolio" property_code="SQMU-DXB-001"]
```

Estatik property page with automatic discovery:

```text
[sqmu_app view="buy"]
```

Crowdfund page:

```text
[sqmu_app view="crowdfund"]
```

Property-specific rent page:

```text
[sqmu_app view="rent" property_code="SQMU-DXB-001"]
```

Read-only rent distribution page:

```text
[sqmu_app view="rent_distribution" property_code="SQMU-DXB-001"]
```

Escrow creation page with property prefill:

```text
[sqmu_app view="escrow" property_code="SQMU-DXB-001"]
```

Existing escrow management page:

```text
[sqmu_app view="escrow" escrow_address="0x1234567890abcdef1234567890abcdef12345678"]
```

Consulting payment page:

```text
[sqmu_payment]
```

## Admin Pages

After activating the plugin, configure it in:

```text
Settings > SQMU App
```

This page is the source of truth for:

- app metadata
- accepted chains
- contract addresses
- accepted payment tokens
- consulting payment recipient, amount, allowed chains, and chain-specific consulting payment tokens
- per-view defaults

Accepted chains, accepted payment tokens, and consulting payment tokens are managed as add-fields plus editable tables in wp-admin, so operators can add, review, edit, and delete entries without hand-editing JSON.

The plugin also adds a browser-signed operations page:

```text
Settings > SQMU Operations
```

This page is restricted to administrators and exposes selected owner/admin actions only.
It does not expose upgrade or ownership-transfer controls.

### Admin operations included

- `SQMUCrowdfund`
  - `setPriceUSD`
  - `withdrawPayments`
- `SQMURent`
  - `setAcceptedToken`
  - `setTreasury`
  - `setManagementFee`
  - `setVault`
  - `refundDeposit`
  - `withdrawManagementFees`
  - `depositNFT`
  - `withdrawNFT`
- `EscrowFactory`
  - `addAllowedToken`
  - `removeAllowedToken`

## Contract Configuration

The settings screen now supports these contract keys:

- `distributor`
- `trade`
- `sqmu`
- `crowdfund`
- `rent`
- `rentDistribution`
- `escrowFactory`

The frontend uses the current repository ABI files as its source of truth:

- `AtomicSQMUDistributor`
- `SQMUTrade`
- `SQMU`
- `SQMUCrowdfund`
- `SQMURent`
- `SQMURentDistribution`
- `Escrow`
- `EscrowFactory`

## Property Meta Contract

Property-specific pages resolve property details from WordPress post meta.

The plugin expects these fixed meta keys:

```text
_sqmu_property_code
_sqmu_token_id
_sqmu_token_address
_sqmu_property_id
_sqmu_property_ref
```

### Meta usage by view

- `buy` and `portfolio`
  - require `_sqmu_token_id`
  - require `_sqmu_token_address`
- `rent` and `rent_distribution`
  - require `_sqmu_property_id`
- `escrow`
  - uses `_sqmu_property_ref` to prefill the create flow

### Behavior

- `property_code` is used first when you want an explicit override
- if `property_code` is omitted on a property-bound view, the plugin tries to discover the property in this order:
  - current queried WordPress post meta
  - `[data-sqmu-property-code]`
  - Estatik label/value HTML for `SQMU Property Code`
  - `?code=...` in the page URL
- once a property code is discovered, the plugin resolves the full property record from WordPress content and locks the widget to that property
- property codes must be unique across published content
- if the selected property is missing required meta for the chosen view, the widget renders a clear configuration error

## Current Constraints

- `rent_distribution` is intentionally read-only in this pass
- write-capable rent distribution is deferred because the current `SQMU` contract does not enumerate holders
- escrow creation requires `contracts.escrowFactory` to be configured in wp-admin
- the rebuilt escrow ABI exists in the repo, but deployment addresses must still be configured in WordPress

## Build And Packaging

From `WordpressPlugin/`:

```bash
npm install
npm run build
```

This generates:

```text
plugin/assets/sqmu.js
plugin/assets/chunks/*.js
```

WordPress enqueues `plugin/assets/sqmu.js` as an ES module. The hashed files in
`plugin/assets/chunks/` are required runtime assets and must ship with the plugin,
because MetaMask SDK is intentionally loaded as split browser modules instead of being
collapsed into one IIFE bundle.

Node is build-time only and is not required on the WordPress host.

## Repo Layout

```text
WordpressPlugin/
├─ src/
│  ├─ contracts/      # ABI exports and default addresses
│  ├─ config.js       # Frontend defaults
│  └─ index.jsx       # React + Wagmi entrypoint
├─ plugin/
│  ├─ sqmu.php        # WordPress bootstrap, admin UI, shortcode, config assembly
│  ├─ assets/
│  │  ├─ sqmu-widgets.css
│  │  ├─ sqmu.js
│  │  └─ chunks/      # Generated browser chunks, including MetaMask SDK split assets
│  └─ readme.txt
├─ esbuild.config.mjs
├─ package.json
└─ README.md
```

## Operator Notes

- Every configured chain must include a working `rpcUrl` because reads happen in the browser.
- Keep contract addresses aligned with deployed environments.
- Use `property_code` for property-bound pages instead of maintaining per-page config.
- Use `escrow_address` only when opening an existing escrow instance.
- If a view renders a configuration error, check:
  - plugin settings
  - property meta
  - duplicate property codes
  - missing contract addresses for that workflow
