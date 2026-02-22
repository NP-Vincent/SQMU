# SQMU Contract Licensing Reference Audit

Date: 2026-02-22
Scope: `SQMU/` (tracked files only)

## Summary

I reviewed tracked files in `SQMU/` for licensing-related terms (`SPDX-License-Identifier`, `license`, `MIT`, `Apache`, `OpenZeppelin`) with focus on Solidity contracts and upstream OpenZeppelin imports.

- **All Solidity contracts in `SQMU/Contracts/` declare `Apache-2.0` SPDX headers**.
- **OpenZeppelin dependencies are consumed via imports (not vendored source)**, so their upstream **MIT** licensing remains applicable to those dependency packages.
- **Project-level contract licensing statements in `SQMU/README.md` are consistent** with the Solidity SPDX headers and the repository root `LICENSE`.

## Findings

### 1) Contract SPDX headers (expected and consistent)

Every tracked contract in `SQMU/Contracts/` begins with:

- `// SPDX-License-Identifier: Apache-2.0`

Reviewed contracts:

- `Contracts/SQMU.sol`
- `Contracts/SQMURent.sol`
- `Contracts/SQMUTrade.sol`
- `Contracts/SQMURentDistribution.sol`
- `Contracts/SQMUCrowdfund.sol`
- `Contracts/Escrow.sol`
- `Contracts/AtomicSQMUDistributor.sol`

This is consistent with an Apache-2.0 licensing posture for first-party SQMU smart contract code.

### 2) OpenZeppelin dependency usage

SQMU contracts import OpenZeppelin modules from npm-style package paths, including:

- `@openzeppelin/contracts-upgradeable/...`
- `@openzeppelin/contracts/...`

These are external dependency imports (not copied source files in this folder). As documented in `SQMU/README.md`, imported OpenZeppelin dependencies remain under their upstream MIT license.

### 3) Project documentation alignment

`SQMU/README.md` states:

- SQMU contracts in `Contracts/` are licensed under Apache-2.0.
- Imported OpenZeppelin dependencies (including upgradeable contracts) remain under MIT.

This aligns with contract SPDX headers and with mixed first-party + third-party dependency licensing expectations.

## Recommended housekeeping

1. Keep `SQMU/README.md` as the concise licensing explainer for contract code and OpenZeppelin dependency treatment.
2. Ensure contract build/deploy tooling (wherever dependency versions are pinned) keeps OpenZeppelin versions explicit for repeatable third-party license audits.
3. If ABI artifacts are distributed independently, consider adding a short note in release docs that ABI JSON files are generated interface artifacts for Apache-2.0 contracts that may reference MIT-licensed dependency interfaces.

## Commands used

- `git ls-files SQMU`
- `rg -n "SPDX-License-Identifier|pragma|import \"@openzeppelin|import '@openzeppelin|license|GPL|MIT|Apache" SQMU/Contracts SQMU/README.md SQMU/deployment_log.md`
- `rg -n "@openzeppelin" SQMU/Contracts/*.sol`
