# Repo guidelines

This repository contains a single HTML/JavaScript widget called **Metamask** for handling crypto payments. The widget leverages Web3Modal and ethers.js to connect wallets and send transactions.

- No automated tests or build steps are present.
- Keep dependencies loaded via CDN and avoid introducing frameworks or bundlers.
- Customize available networks or tokens in the `PAYMENT_OPTIONS` array inside the widget.
