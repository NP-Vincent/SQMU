# SQMU WordPress Plugin – Admin-Configured Wallet App

## Purpose

This folder contains the WordPress integration layer for the SQMU wallet application.
It serves one compiled React + Wagmi bundle through a PHP plugin, keeps runtime
configuration in WordPress admin settings, and uses a lightweight shortcode only
to place a view into page content.

The plugin is designed so that:

- site operators configure chains, contracts, payment tokens, and view defaults once in wp-admin
- content editors place views with a short shortcode
- property-specific pages reference a property code instead of embedding raw JSON

---

## Architecture

The plugin keeps a clear boundary between WordPress and the frontend bundle:

- PHP owns:
  - shortcode registration
  - asset enqueueing
  - admin settings UI
  - property lookup from WordPress post meta
  - normalized runtime config injection
- React + Wagmi owns:
  - wallet connection
  - chain switching
  - contract reads and writes
  - buy and portfolio views

Runtime is direct browser-to-chain. WordPress is not used as a REST proxy in this version.

---

## Shortcode

The only public shortcode is:

```text
[sqmu_app view="buy|portfolio" property_code="OPTIONAL_CODE"]
```

### Attributes

- `view`
  - Selects the frontend view.
  - Allowed values: `buy`, `portfolio`
- `property_code`
  - Optional in general.
  - Use it on property-specific pages so the plugin resolves the matching WordPress property record and injects that property into the frontend config.

### Examples

Generic buy view:

```text
[sqmu_app view="buy"]
```

Property-specific buy page:

```text
[sqmu_app view="buy" property_code="SQMU-DXB-001"]
```

Property-specific portfolio workspace:

```text
[sqmu_app view="portfolio" property_code="SQMU-DXB-001"]
```

Portfolio page:

```text
[sqmu_app view="portfolio"]
```

### What the shortcode no longer does

The shortcode is no longer responsible for:

- chain IDs
- RPC URLs
- contract addresses
- payment token lists
- feature flags
- raw JSON config blobs

That configuration is now owned by the plugin admin settings screen.

---

## Admin Configuration

After activating the plugin, configure it in:

```text
Settings > SQMU App
```

The admin screen is the source of truth for:

- application metadata
- accepted chains
- distributor, trade, and SQMU contract addresses
- accepted payment tokens
- per-view defaults
  - default chain ID
  - feature flags for buy, portfolio, and sell behavior

### Supported settings model

The plugin uses:

- one global base configuration
- per-view defaults for `buy` and `portfolio`

PHP assembles the final runtime config for each mount and passes it to the frontend.

---

## Property Meta Contract

Property-specific pages resolve property details from WordPress post meta.

The plugin expects these fixed meta keys:

```text
_sqmu_property_code
_sqmu_token_id
_sqmu_token_address
```

### Behavior

- The shortcode uses `property_code` to find a published WordPress post with matching `_sqmu_property_code`.
- If exactly one post matches, the plugin injects that property into the frontend config.
- If no post matches, more than one post matches, or required token metadata is missing, the frontend renders a clear configuration error card.

### Expectations

- property codes must be unique across published content
- `_sqmu_token_id` must be numeric
- `_sqmu_token_address` must be present for property-specific flows

---

## Build And Packaging

From `WordpressPlugin/`:

```bash
npm install
npm run build
```

This generates:

```text
plugin/assets/sqmu.js
```

The WordPress plugin enqueues that built asset directly. Node is build-time only and is not required on the WordPress host.

The WordPress.com workflow also verifies that the generated bundle exists at the same path the plugin enqueues.

---

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
│  │  └─ sqmu.js
│  └─ readme.txt
├─ esbuild.config.mjs
├─ package.json
└─ README.md
```

---

## Operator Notes

- Configure chains with valid `rpcUrl` values. The frontend performs direct reads from the browser.
- Keep contract addresses up to date with the current deployed environment.
- Use `property_code` on property-specific pages instead of maintaining per-page config.
- `buy` is the distributor purchase flow.
- `portfolio` is the combined holdings, marketplace, buy-from-listing, and listing-management workspace.
- If a view renders a configuration error, check:
  - plugin settings
  - matching property post meta
  - duplicate property codes

---

## Module Reference

This folder is the WordPress-owned integration layer for SQMU.
It is responsible for keeping the admin-configured runtime model stable and exposing the `[sqmu_app]` shortcode cleanly to editors and operators.
