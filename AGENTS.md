# Repository Guidelines

This repository stores a minimal cryptocurrency payment widget designed for embedding in a WordPress "Custom HTML" block.

## Development
Metamask 1.0.html
- Place all source code in standalone HTML files at the repo root.
- Use CDN imports for **ethers.js**, and **qrcode**.
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
- No further changes to be made to Mwetamask 1.0.html. Preserve as fully functional fallback. 

Metamask 2.0.html
- Under development better integration for features including better integration with Wordpress.com HTML and CSS

## Changelog
- Add to changelog in AGENTS.md after completion of changes

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
- 2025-06-22-12:25; Bypass gas estimation on transfer.
- 2025-06-22-13:10; Validate USD amount before sending payment.
- 2025-06-22-14:30; Added token/chain query parameters to preselect network.
