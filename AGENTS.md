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

- `switchNetwork` now tries to add the chain when `wallet_switchEthereumChain`
  returns error 4902. Earlier versions simply showed "Network switch failed" if
  the user had not added the chain, so this logic prevents that failure.

## Verification
- Run `tidy -errors SimpleWidget.html` after modifications to validate the HTML.
- Add to changelog in AGENTS.md if no errors are found.

## Commit messages
Use short, descriptive commit messages (e.g., `Add payment widget skeleton`).

## Changelog
- 2025-06-20-21:36; Initial MetaMask support added.
- 2025-06-21-09:26; Introduced explicit wallet connect functions and simplified widget.
- 2025-06-21-11:53; Fixed provider reload after network switch.
- 2025-06-21-14:12; Handling missing chains by adding the network before switching.
- 2025-06-21-22:42; Added QR code display and documented network switch behavior.
- 2025-06-21-23:17; Improved network checks and error messages.
- 2025-06-21-23:50; Refined wallet setup, network handling, and UI controls.
- 2025-06-21-23:55; Switched to ethers.toQuantity in network logic.
