# SQMU Reference Implementation

SQMU (Square Metre Unit) provides an open-source standard for real estate tokenization.
This repository includes:
- SQMU core Solidity smart contracts implementing the ERC-1155 based standard.
- A SQMU WordPress plugin to deploy, manage, and integrate SQMU tokens into WordPress.

The goal is to enable developers and organizations to adopt, integrate, and build on the SQMU standard with transparency and regulatory clarity.

## Objectives of the Open-Source Release

- Provide a reference implementation of SQMU tokenization for developers.
- Allow interoperability and standardization across deployments.
- Facilitate regulatory inspection and compliance.
- Promote adoption through clear documentation and a ready-to-use WordPress plugin.

## Repository Layout

- `SQMU/` — Core contract artifacts and ABI resources ([module README](SQMU/README.md)).
- `WordpressPlugin/` — WordPress plugin source, build configuration, and reference UI assets ([module README](WordpressPlugin/README.md)).
- `GoogleAppScript/` — Optional email receipt scripts for listing, payments, governance, escrow, and rent flows ([module README](GoogleAppScript/README.md)).

## Getting Started / Installation

## SQMU Core Contracts

Deploy the contracts with your preferred Solidity tooling (for example Hardhat, Remix, or Truffle):

1. Review contract ABIs and deployment inputs in `SQMU/`.
2. Configure network RPC endpoints, deployer wallet, and gas settings in your chosen toolchain.
3. Deploy contracts in the order required by your target environment.
4. Save deployed addresses and ABI metadata for front-end/plugin integration.

## SQMU WordPress Plugin

1. Open `WordpressPlugin/` and install dependencies:
   - `npm ci`
2. Build the plugin assets:
   - `npm run build`
3. Copy or package `WordpressPlugin/plugin/` into your WordPress installation.
4. Activate the plugin in WordPress admin.
5. Configure network, contract addresses, and widget shortcodes in site content:
   - `metamask_dapp`
   - `sqmu_listing`
   - `sqmu_portfolio`

## Local Docker Stack

The repo includes a sanitized Docker Compose template at `docker/compose.sqmu.example.yml`.
It uses explicit SQMU container, network, and volume names so Docker resources can be traced back to this repository.
Keep your real local stack in `docker/compose.sqmu.yml`, which is ignored by git and should not contain production secrets.
For the ongoing public-repository policy and pre-push hygiene checklist, see [`docs/public-repo-hygiene.md`](docs/public-repo-hygiene.md).

Create your local Compose file:

```bash
cp docker/compose.sqmu.example.yml docker/compose.sqmu.yml
```

Optionally create a private env file for local port or password overrides:

```bash
cp docker/.env.example docker/.env
```

Do not commit `docker/compose.sqmu.yml` or `docker/.env`; both are ignored so local secrets and experiments stay out of the public repo.

Start the release-parity WordPress + MySQL + Anvil stack:

```bash
docker compose -f docker/compose.sqmu.yml up -d
```

Start the same stack with the optional chain explorer:

```bash
docker compose -f docker/compose.sqmu.yml --profile explorer up -d
```

Start the reusable Node development tools container:

```bash
docker compose -f docker/compose.sqmu.yml --profile tools up -d sqmu-node-tools
```

Run repeated contract or plugin commands through the named tools container:

```bash
docker exec sqmu-node-tools sh -lc "cd SQMU && npm ci && npm test"
docker exec sqmu-node-tools sh -lc "cd WordpressPlugin && npm ci && npm run build"
```

Stop the stack without deleting persisted WordPress/MySQL state:

```bash
docker compose -f docker/compose.sqmu.yml stop
```

Remove the stack and its named SQMU volumes only when you intentionally want a clean rebuild:

```bash
docker compose -f docker/compose.sqmu.yml down -v
```

## Module Documentation

- Contracts & ABI: [`SQMU/README.md`](SQMU/README.md)
- WordPress Plugin: [`WordpressPlugin/README.md`](WordpressPlugin/README.md)
- Google Apps Script receipts: [`GoogleAppScript/README.md`](GoogleAppScript/README.md)

## Usage Examples

Typical implementation flows include:

- Minting SQMU tokens for a verified real-estate asset.
- Managing portfolio and listing experiences through WordPress widgets.
- Integrating rent/payment workflows with optional Google Apps Script receipt automation.
- Emitting and consuming on-chain events for auditability and reporting.

## License & Attribution

Licensed under the Apache License, Version 2.0.
See `LICENSE` and `NOTICE.md` for attribution and third-party dependency notices.

## Contributing

See `CONTRIBUTING.md` for contribution guidelines. If no contributing guide is present yet, open an issue describing the change proposal and scope.

## Support / Contact

For questions, implementation support, or partnership inquiries, contact N P Vincent or the SQMU team.
