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
- When authoring the widget markup keep the `<body>` and main container
  (`#widget`) styles minimal. Avoid fixed widths so the widget inherits the
  width of the WordPress column. Center buttons and content with `text-align:
  center` and allow text to wrap naturally within the parent column.
- Follow the Masu theme by removing all <style> blocks and inline CSS from the widget. Use WordPress classes such as `wp-block-button__link` on <button> elements. Let the <body> and #widget widths inherit from the surrounding block. Inline `display` toggles may remain.

## Token Sale Workflow
The README describes how this widget fits into a larger SQMU sale process:
- Create a unique SQMU ERC-20 token for each property using the WPSmartContract plugin. Token supply equals the property's square metres and is deployed on Polygon.
- Deploy a sale or delivery contract (e.g. `SqmuDistributor.sol`) on the same chain. This contract is approved to transfer SQMU from a treasury address to the buyer once payment is confirmed.
- `payment-launch.html` is embedded in property pages. It gathers the property title, USD amount and desired stablecoin network and then opens the appropriate `Metamask 2.x.html` checkout page.
- The checkout page handles USDT on Ethereum, USDC on Arbitrum or Polygon and, after receiving payment, calls the sale contract to distribute SQMU tokens to the buyer.
- Keep the sale contract and destination addresses near the top of the HTML files so they can be updated for each property.

## Changelog
- Add to changelog in AGENTS.md after completion of changes

## Commit messages
Use short, descriptive commit messages (e.g., `Add payment widget skeleton`).

## Changelog
- 2025-06-20-21:36-UTC; Initial MetaMask support added.
- 2025-06-21-09:26-UTC; Introduced explicit wallet connect functions and simplified widget.
- 2025-06-21-11:53-UTC; Fixed provider reload after network switch.
- 2025-06-21-14:12-UTC; Handling missing chains by adding the network before switching.
- 2025-06-21-22:42-UTC; Added QR code display and documented network switch behavior.
- 2025-06-21-23:17-UTC; Improved network checks and error messages.
- 2025-06-21-23:50-UTC; Refined wallet setup, network handling, and UI controls.
- 2025-06-21-23:55-UTC; Switched to ethers.toQuantity in network logic.
- 2025-06-22-12:25-UTC; Bypass gas estimation on transfer.
- 2025-06-22-13:10-UTC; Validate USD amount before sending payment.
- 2025-06-22-14:30-UTC; Added token/chain query parameters to preselect network.
- 2025-06-23-12:59-UTC; Added checkout page to send amount and network to Metamask 2.0.
- 2025-06-23-13:11-UTC; Display purchase token info on payment launcher.
- 2025-06-23-13:21-UTC; Fix query string handling between pages.
- 2025-06-23-13:39-UTC; Support dynamic titles and AED pricing in checkout link.
- 2025-06-23-13:55-UTC; Ensure AED param in launch URL and fallback calculation in checkout.
- 2025-06-23-14:19-UTC; Retrieve title from page and build checkout URL with URL.searchParams.
- 2025-06-23-14:25-UTC; Document WordPress embedding and visual editor caution.

- 2025-06-23-21:30-UTC; Fix network preselection and keep dropdown editable.
- 2025-06-23-22:10-UTC; Parse buy params and send SQMU3 after payment.
- 2025-06-23-22:40-UTC; Add sale-contract purchase flow with PolygonScan links.
- 2025-06-24-00:00-UTC; Fix explorer links for ethers v6.
- 2025-06-23-23:58-UTC; Added Metamask 2.1 and SQMU distributor contract.
- 2025-06-24-12:18-UTC; Documented token sale workflow from README.
- 2025-06-25-09:57-UTC; Add deposit computation to launcher and button snippet.
- 2025-06-25-10:12-UTC; Added post-payment section with scheduling and copy to clipboard.
- 2025-06-25-10:15-UTC; Document deposit calculation and post-payment meeting scheduling features.
- 2025-06-25-10:20-UTC; Handle fractional AED amounts in launcher.
- 2025-06-25-10:22-UTC; Added copyDetails function for clipboard copying.
- 2025-06-25-14:40-UTC; Simplified Metamask 2.0 to omit SQMU token delivery.
- 2025-06-25-16:30-UTC; Added email receipt option using EmailJS.
- 2025-06-25-17:00-UTC; Switched receipts to Google Apps Script.
- 2025-06-25-18:00-UTC; Added mobile wallet browser instructions.

- 2025-06-25-19:05-UTC; Validate POST data in Apps Script.
- 2025-06-25-20:00-UTC; Update public Apps Script URL.
- 2025-06-25-20:10-UTC; Replace AJAX email with form submission in Metamask 2.0.
- 2025-06-25-21:00-UTC; Accept form POST in Apps Script.
- 2025-06-25-21:30-UTC; Centered layout and removed fixed widget width.
- 2025-06-25-20:26-UTC; Document Masu theme requirements for widgets.
- 2025-06-26-00:00-UTC; Removed inline styles and added wp-block button classes.
