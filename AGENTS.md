# Repository Guidelines

This repository stores a minimal cryptocurrency payment widget designed for embedding in a WordPress "Custom HTML" block.

## Development
- Place all source code in standalone HTML files at the repo root.
- Use CDN imports for **WalletConnect**, **ethers.js**, and **qrcode**.
- Maintain a `PAYMENT_OPTIONS` array with:
  1. USDT on Ethereum mainnet
  2. USDC on Arbitrum One
  3. USDC on Polygon
- Keep styling lightweight and rely on WordPress theme CSS.
- Initialize the widget on `DOMContentLoaded` and read `title`, `aed`, and `usd` query parameters to populate the UI.
- Separate wallet setup, balance lookup, and token transfer into small functions.
- Provide concise error messages and transaction feedback.

## Verification
Run `tidy -errors SimpleWidget.html` after modifications to validate the HTML.

## Commit messages
Use short, descriptive commit messages (e.g., `Add payment widget skeleton`).
