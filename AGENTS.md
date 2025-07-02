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
- No further changes to be made to Metamask 1.0.html. Preserve as fully functional fallback. 

Metamask 2.0.html
- Under development better integration for features including better integration with Wordpress.com HTML and CSS
- When authoring the widget markup keep the `<body>` and main container
  (`#widget`) styles minimal. Avoid fixed widths so the widget inherits the
  width of the WordPress column. Center buttons and content with `text-align:
  center` and allow text to wrap naturally within the parent column.
 - Follow the Masu theme. A short `<style>` section may be included for dropdown sizing, padding and layout tweaks. Use WordPress button classes like `wp-block-button__link`. Avoid inline styles except simple `display` toggles.

## Token Sale Workflow
The README describes how this widget fits into a larger SQMU sale process:
- Create a unique SQMU ERC-20 token for each property using the WPSmartContract plugin. Token supply equals the property's square metres and is deployed on Polygon.
- Deploy a sale or delivery contract (e.g. `MultiSqmuDistributor.sol`) on the same chain. This contract is approved to transfer SQMU from a treasury address to the buyer once payment is confirmed.
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
- 2025-06-25-20:34-UTC; Removed inline styles and added wp-block button classes.
- 2025-06-26-20:39-UTC; Updated show helper to use textContent and sanitized receipt form in Metamask 2.0.
- 2025-06-25-20:43-UTC; Corrected Mwetamask reference in guidelines.
- 2025-06-25-21:04-UTC; Updated styling guidance allowing small <style> blocks.
- 2025-06-26-20:49-UTC; Required email field with label added.
- 2025-06-26-20:55-UTC; Automatically email receipt after payment.
- 2025-06-26-20:56-UTC; Added layout spacing and required label styling in Metamask 2.0.
- 2025-06-26-21:30-UTC; Added agent commission support and agent code input in Metamask 2.1 with updated distributor contract.
- 2025-06-27-09:05-UTC; Added email receipt field and automatic sending to Metamask 2.1.
- 2025-06-27-09:09-UTC; Enhanced receipt email with token details and wallet instructions.
- 2025-06-27-09:40-UTC; Fixed duplicate receipt emails in Metamask 2.1.
- 2025-06-27-10:00-UTC; Added fail flag to receipt emails when SQMU delivery fails.
- 2025-06-27-10:30-UTC; Added SQMU supply check before payment in Metamask 2.1.
- 2025-06-27-11:20-UTC; Added available supply view to SqmuDistributor.
- 2025-06-27-12:00-UTC; Added SQMU balance display and token amount purchase option in launcher.
- 2025-06-27-14:00-UTC; Updated payment pages to SQMU4 token references.
- 2025-06-27-15:20-UTC; Removed owner check from distributor and redeployed contract on Polygon.
- 2025-06-27-15:45-UTC; Updated distributor address in payment pages.
- 2025-06-27-15:50-UTC; Clarified token claiming instructions in receipt.
- 2025-06-27-16:10-UTC; Added manual delivery messaging and SQMU amount
  forwarding between pages.
- 2025-06-29-21:51-UTC; Added user instructions, layout tweaks and receipt updates for new purchase flows.

- 2025-06-29-22:09-UTC; Reordered forms before instructions and moved QR/status higher.
- 2025-06-29-22:34-UTC; Wrapped status text to prevent overflow.
- 2025-06-29-22:36-UTC; Increased input field size and font inheritance.
- 2025-06-29-22:45-UTC; Harmonized launcher input styling and added message area.
- 2025-06-30-16:53-UTC; Added Calendly popup integration for schedule buttons.
- 2025-06-30-19:48-UTC; Added admin interface and owner-only distribution.
- 2025-07-01-16:18-UTC; Allow decimal SQMU amounts and parse units in admin page.
- 2025-07-01-16:45-UTC; Added stablecoin commissions in SqmuDistributor.
- 2025-07-01-16:50-UTC; Document SQMU amount parsing in admin interface.
- 2025-07-01-17:00-UTC; Updated distributor deployment instructions for USDC commissions.
- 2025-07-01-17:10-UTC; Document fractional SQMU and USDC commissions in README.
- 2025-07-01-17:30-UTC; Introduced MultiSqmuDistributor with property registration.
- 2025-07-01-19:57-UTC; Added property code selection and logging.
- 2025-07-01-20:05-UTC; Added dynamic property params and supply checks.
- 2025-07-01-20:12-UTC; Read property and sale params from query string.
- 2025-07-01-20:22-UTC; Pass property code and token address in receipt emails.
- 2025-07-01-20:40-UTC; Added property registration form and sheet logging.
- 2025-07-01-21:00-UTC; Documented MultiSqmuDistributor and property-aware pages.
- 2025-07-01-21:30-UTC; Admin page registers properties on-chain with treasury address.
- 2025-07-02-00:00-UTC; Updated payment pages to generic SQMU and new distributor address.
- 2025-07-02-12:30-UTC; Read SQMU code and price from Estatik elements.
- 2025-07-02-13:00-UTC; Improve Estatik parsing for property code and USD value.
