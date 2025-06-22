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
- Tidy must be installed (for example `sudo apt-get install tidy` or `brew install tidy-html5`).
- Alternatively run `docker run --rm -v $(pwd):/workspace -w /workspace dcycle/html-tidy tidy -errors SimpleWidget.html`.
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
- 2025-06-22-12:25; Bypass gas estimation on transfer.
- 2025-06-22-12:43; Added MobileCompWidget with mobile MetaMask deep linking.
- 2025-06-22-13:00; Fixed MetaMask deep link to use sqmu.net domain.
- 2025-06-22-13:14; Updated MobileCompWidget deep link to remove encoding.
- 2025-06-22-15:19; Added MobileCompWidget2 with WalletConnect deep linking.
- 2025-06-22-16:04; Added MetamaskSQMUSDK widget using MetaMask SDK.

## Development rationale
Using MetaMask SDK avoids direct `window.ethereum` access and ensures the
widget works across browsers and platforms where MetaMask injects a provider
asynchronously.
