# Public Repository Hygiene

SQMU is a public-facing repository. Treat every tracked file as already public and keep local development state, experimental infrastructure, and credentials outside git.

## Policy

- Commit only source code, documentation, public ABI artifacts, sanitized examples, and intentional release metadata.
- Do not commit private keys, seed phrases, RPC provider URLs with credentials, API tokens, passwords, production endpoints, customer data, WordPress database dumps, local Docker overrides, generated build outputs, or editor/system artifacts.
- Keep local runtime configuration in ignored files such as `docker/compose.sqmu.yml`, `docker/.env`, root `.env*` files, or tool-specific local override files.
- Keep public templates sanitized. Checked-in examples may include placeholder values only when they are clearly development-only and unusable as production credentials.
- Store deployment secrets in the operator's wallet, local secret manager, or GitHub Actions secrets/environments. Do not place them in workflow YAML, package scripts, Compose files, or documentation examples.
- Public deployment records may include on-chain addresses, transaction hashes, versions, network names, and explorer links. They must not include deployer private keys, seed material, internal RPC credentials, or unreleased customer/property records.

Known intentional public development values:

- The Anvil private key used by `SQMU/scripts/*anvil*.cjs` is Foundry's default local test account and must only be used against local chains.
- `docker/.env.example` and `docker/compose.sqmu.example.yml` contain placeholder development database passwords so the example stack can boot without real credentials.

## Methodology

Run this hygiene check before publishing, tagging, or opening a pull request from local work:

```bash
git status --short --ignored
git diff --check
git diff --name-status origin/main..HEAD
git ls-files | rg '(^|/)(\.env|.*\.local|.*secret.*|.*credential.*|.*key.*|.*dump.*|.*backup.*)$'
rg -n -i --glob '!SQMU/node_modules/**' --glob '!WordpressPlugin/node_modules/**' '(secret|private[_-]?key|mnemonic|seed phrase|password|passwd|token|api[_-]?key|client[_-]?secret|bearer|authorization|rpc[_-]?url|alchemy|infura|etherscan)' .
```

Review the matches manually. Many hits are expected because contracts and plugin settings use words like token and RPC URL, but any real credential or private endpoint is a release blocker.

Before pushing, confirm:

1. `git status --short` shows only intentional tracked changes.
2. `git status --short --ignored` shows local artifacts under ignored paths, not tracked paths.
3. Docker and environment changes are represented by sanitized `.example` files, not local working files.
4. Generated outputs are rebuilt by CI or documented release scripts rather than committed ad hoc.
5. Any deployment or interface change has a public-safe note that includes addresses and versions only when they are intended to be disclosed.

If a secret is ever committed, assume it is compromised. Rotate it immediately, remove it from current history with an explicit remediation plan, and document the incident privately before publishing follow-up commits.
