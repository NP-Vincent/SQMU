# SQMU WordPress Plugin – React + Wagmi Wallet App

## Purpose

This repository defines a **WordPress-first SQMU plugin** that ships a
single JavaScript bundle and a shortcode-mounted React application. The current scope is
centered on:

- MetaMask and injected-wallet connection helpers
- SQMU distributor buy flows
- SQMU trade listing flows
- SQMU portfolio readouts
- WordPress shortcode mounts for each view

The project keeps all WordPress integration in PHP and all wallet/contract logic
in the browser bundle to preserve a clean separation of concerns.

---

## Design Principles

1. **Single bundle, single initializer** – one public JavaScript entrypoint.
2. **No runtime Node.js in production** – Node is build-time only.
3. **Deterministic builds** – esbuild creates a consistent output bundle.
4. **Strict separation of concerns**
   - JavaScript: React UI + wallet + contract logic
   - PHP: WordPress glue, configuration, rendering
5. **WordPress only receives compiled assets** (JS/CSS)

---

## Repository Structure (Current)

```
WordpressPlugin/
├─ src/
│  ├─ contracts/           # Contract ABIs + default addresses
│  ├─ config.js            # Default chain/payment token settings
│  └─ index.jsx            # React + Wagmi entrypoint
├─ plugin/
│  ├─ sqmu.php            # WordPress plugin bootstrap + shortcodes
│  ├─ assets/
│  │  ├─ sqmu-widgets.css  # Application styling
│  │  └─ sqmu.js           # Build output (generated)
│  └─ readme.txt
├─ esbuild.config.mjs
├─ package.json
└─ README.md
```

---

## Public JavaScript API

The JavaScript bundle exposes **one initializer**:

```js
export function initSQMU(config) {
  // config injected by WordPress
}
```

Runtime configuration is injected by PHP and passed to
`window.SQMUWP.initSQMU`.

### Mounting behavior

- WordPress renders shortcode mount elements with `data-sqmu-app`.
- The initializer reads the mount `view` and the normalized config injected by PHP.
- Each mount renders one React view.

Supported views:

- `buy`
- `listing`
- `portfolio`

---

## WordPress Plugin Responsibilities

The WordPress plugin provides:

- Shortcodes that render widget mount points
- Script/style enqueueing
- Runtime configuration injection (PHP → JS)

Shortcode available:

- `[sqmu_app view="buy|listing|portfolio" config='{"version":1,...}']`

Configuration values are passed via shortcode attributes and injected into the
bundle via `window.SQMU_CONFIG`.

## Shortcode Usage

The plugin now uses one primary shortcode:

```text
[sqmu_app view="buy|listing|portfolio" config='{"version":1,...}']
```

### Attributes

- `view`
  - Required in practice.
  - Selects which React view to render.
  - Allowed values: `buy`, `listing`, `portfolio`
- `config`
  - JSON string passed to the frontend runtime.
  - Should contain the chain, contract, payment-token, and feature configuration needed by the selected view.

### Config shape

The `config` JSON is normalized around these top-level keys:

```json
{
  "version": 1,
  "app": {
    "name": "SQMU Wallet",
    "url": "https://example.com/",
    "infuraApiKey": "optional-infura-key"
  },
  "defaultChainId": 59144,
  "chains": [
    {
      "id": 59144,
      "name": "Linea",
      "rpcUrl": "https://linea.infura.io/v3/YOUR_KEY",
      "blockExplorerUrl": "https://lineascan.build",
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      }
    }
  ],
  "contracts": {
    "distributor": "0x...",
    "trade": "0x...",
    "sqmu": "0x..."
  },
  "paymentTokens": [
    {
      "address": "0x...",
      "symbol": "USDC",
      "decimals": 6
    }
  ],
  "properties": [
    {
      "propertyCode": "SQMU-DXB-001",
      "tokenId": 1,
      "tokenAddress": "0x..."
    }
  ],
  "features": {
    "buy": true,
    "listing": true,
    "portfolio": true,
    "sell": true
  }
}
```

### Minimum requirements by view

- `buy`
  - `chains`
  - `defaultChainId`
  - `contracts.distributor`
  - `contracts.sqmu`
  - `paymentTokens`
  - `properties` or a property code entered manually in the UI
- `listing`
  - `chains`
  - `defaultChainId`
  - `contracts.trade`
  - `contracts.distributor`
  - `contracts.sqmu`
  - `paymentTokens`
  - `properties` for creating listings
- `portfolio`
  - `chains`
  - `defaultChainId`
  - `contracts.trade`
  - `contracts.distributor`
  - `contracts.sqmu`
  - `properties`

### Example shortcodes

Buy flow:

```text
[sqmu_app
  view="buy"
  config='{"version":1,"app":{"name":"SQMU Wallet","url":"https://example.com/"},"defaultChainId":59144,"chains":[{"id":59144,"name":"Linea","rpcUrl":"https://linea.infura.io/v3/YOUR_KEY","blockExplorerUrl":"https://lineascan.build","nativeCurrency":{"name":"Ether","symbol":"ETH","decimals":18}}],"contracts":{"distributor":"0x19d8D25DD4C85264B2AC502D66aEE113955b8A07","trade":"0x4F1BFDC7EBba77e7ec76C6AEbE81C0e84d28470B","sqmu":"0xd0b895e975f24045e43d788d42BD938b78666EC8"},"paymentTokens":[{"address":"0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4","symbol":"USDC","decimals":6},{"address":"0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df","symbol":"USDT","decimals":6}],"properties":[{"propertyCode":"SQMU-DXB-001","tokenId":1,"tokenAddress":"0xd0b895e975f24045e43d788d42BD938b78666EC8"}],"features":{"buy":true,"listing":true,"portfolio":true,"sell":true}}']
```

Portfolio flow:

```text
[sqmu_app
  view="portfolio"
  config='{"version":1,"defaultChainId":59144,"chains":[{"id":59144,"name":"Linea","rpcUrl":"https://linea.infura.io/v3/YOUR_KEY","blockExplorerUrl":"https://lineascan.build","nativeCurrency":{"name":"Ether","symbol":"ETH","decimals":18}}],"contracts":{"distributor":"0x19d8D25DD4C85264B2AC502D66aEE113955b8A07","trade":"0x4F1BFDC7EBba77e7ec76C6AEbE81C0e84d28470B","sqmu":"0xd0b895e975f24045e43d788d42BD938b78666EC8"},"properties":[{"propertyCode":"SQMU-DXB-001","tokenId":1,"tokenAddress":"0xd0b895e975f24045e43d788d42BD938b78666EC8"},{"propertyCode":"SQMU-DXB-002","tokenId":2,"tokenAddress":"0xd0b895e975f24045e43d788d42BD938b78666EC8"}]}']
```

### Authoring notes

- The `config` attribute must be valid JSON.
- Keep the whole JSON inside single quotes in the shortcode so the JSON can keep double quotes.
- Each configured chain should include an `rpcUrl`, because the frontend performs direct browser-to-chain reads.
- `properties` should be treated as the WordPress-side catalog for buy, listing, and portfolio views.
- If the config is malformed or missing required contract/chain information, the app renders a configuration error card in the page.

---

## Build System (esbuild)

Build output is a single browser bundle staged directly into the plugin asset path:

```
plugin/assets/sqmu.js
```

The WordPress.com workflow copies the plugin assets into:

```
wpcom-stage/sqmu/assets/sqmu.js
```

The CSS companion file lives in `plugin/assets/sqmu-widgets.css`.

### Local build

From `WordpressPlugin/`:

```bash
npm install
npm run build
```

This writes the compiled bundle to:

```text
plugin/assets/sqmu.js
```

At runtime, WordPress serves only the compiled plugin assets. Node is not required on the WordPress host.

---

## Development Direction

The repository is evolving into a focused SQMU wallet application with a React +
Wagmi frontend. Current priorities:

1. Keep wallet/contract logic isolated from WordPress-specific concerns.
2. Preserve the single initializer + deterministic build pipeline.
3. Align UI styling with the **active WordPress theme defaults** by using
   inherited typography and WordPress preset tokens (spacing, color, etc.)
   instead of coupling widget styles to a specific reference theme snapshot.

### Theme Inheritance Policy

- The plugin must inherit from whichever theme is active on the site.
- Widget styles are layout-only and should rely on WordPress/theme typography, color, and button defaults.
- New styling decisions should prefer WordPress preset tokens and semantic block classes over copied theme CSS.

Anything that breaks these constraints should be treated as experimental and
requires explicit review.

---

## SQMU Module Reference

This folder is the **WordPress integration layer** for SQMU. It owns shortcode-rendered user journeys and wallet-connected contract interactions while keeping WordPress-specific behavior in plugin PHP boundaries.

Key shortcode:
- `[sqmu_app]`
