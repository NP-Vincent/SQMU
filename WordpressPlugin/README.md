# MetaMask WordPress dApp – SQMU Widgets Baseline

## Purpose

This repository defines a **WordPress-first MetaMask dApp plugin** that ships a
single JavaScript bundle and a set of SQMU-focused widgets. The current scope is
centered on:

- MetaMask wallet connection helpers
- SQMU distributor/listing purchase flows
- SQMU portfolio readouts
- WordPress shortcodes that mount each widget

The project keeps all WordPress integration in PHP and all wallet/contract logic
in JavaScript to preserve a clean separation of concerns.

---

## Design Principles

1. **Single bundle, single initializer** – one public JavaScript entrypoint.
2. **No runtime Node.js in production** – Node is build-time only.
3. **Deterministic builds** – esbuild creates a consistent output bundle.
4. **Strict separation of concerns**
   - JavaScript: wallet + contract + UI logic
   - PHP: WordPress glue, configuration, rendering
5. **WordPress only receives compiled assets** (JS/CSS)

---

## Repository Structure (Current)

```
metamask-wp-dapp/
├─ src/
│  ├─ contracts/           # Contract ABIs + helpers
│  ├─ ui/                  # Shared DOM helpers
│  ├─ wallet/              # MetaMask SDK integration
│  ├─ widgets/             # SQMU widgets (listing + portfolio)
│  ├─ config.js            # On-chain addresses + mail endpoints
│  └─ index.js             # Public JS initializer
├─ plugin/
│  ├─ metamask-dapp.php    # WordPress plugin bootstrap + shortcodes
│  ├─ assets/
│  │  └─ sqmu-widgets.css  # Widget styling
│  └─ readme.txt
├─ dist/                   # Local build output (gitignored)
├─ esbuild.config.mjs
├─ package.json
└─ README.md
```

---

## Public JavaScript API

The JavaScript bundle exposes **one initializer**:

```js
export function initMetaMaskDapp(config) {
  // config injected by WordPress
}
```

Runtime configuration is injected by PHP and passed to
`window.MetaMaskWP.initMetaMaskDapp`.

### Mounting behavior

- If no widget mounts exist, the baseline MetaMask dApp UI mounts.
- If mounts exist, the initializer looks for `data-mmwp-widget` on each mount
  and loads the matching widget.

Supported widget keys:

- `metamask-dapp`
- `sqmu-listing`
- `sqmu-portfolio`

---

## WordPress Plugin Responsibilities

The WordPress plugin provides:

- Shortcodes that render widget mount points
- Script/style enqueueing
- Runtime configuration injection (PHP → JS)

Shortcodes available:

- `[metamask_dapp]` – base wallet + distributor UI
- `[sqmu_listing]` – SQMU listing purchase flow
- `[sqmu_portfolio]` – SQMU holdings/portfolio view

Configuration values are passed via shortcode attributes and injected into the
bundle via `window.METAMASK_DAPP_CONFIG`.

---

## Build System (esbuild)

Build output is always a single bundle:

```
dist/metamask-dapp.js
```

The WordPress.com workflow stages that output into:

```
wpcom-stage/metamask-dapp/assets/metamask-dapp.js
```

The CSS companion file lives in `plugin/assets/sqmu-widgets.css`.

---

## Development Direction

The repository is evolving into a focused SQMU widget suite while maintaining a
minimal, framework-agnostic JavaScript core. Current and upcoming priorities:

1. Expand SQMU listing + portfolio UX within the existing widget model.
2. Keep wallet/contract logic isolated from WordPress-specific concerns.
3. Preserve the single initializer + deterministic build pipeline.
4. Align UI styling with Masu theme references in
   `references/wordpress/theme/masu-wpcom`.

Anything that breaks these constraints should be treated as experimental and
requires explicit review.
