# SQMU Agent Model

## Overview

AGENTS are logical roles/components that interact with SQMU contracts and the WordPress plugin.
They define responsibilities and interactions for developers, operators, and end users.

## Core Agents

- **Contract Agent**
  - Owns the on-chain layer (`SQMU/Contracts`) and versioned ABI artifacts (`SQMU/ABI`).
  - Controls deployment and upgrade planning, including migration/interface impact notes.
  - Maintains authoritative references for deployed addresses, governance settings, and event/method semantics consumed downstream.

- **WordPress Agent**
  - Owns the WordPress integration layer (`WordpressPlugin`) for admin and end-user journeys.
  - Connects shortcode/widget wallet interactions (`metamask_dapp`, `sqmu_listing`, `sqmu_portfolio`) to contract operations.
  - Keeps WordPress-specific logic in PHP/plugin boundaries while keeping JavaScript framework-agnostic.

- **GoogleAppScript Agent**
  - Owns receipt and communication automation scripts in `GoogleAppScript`.
  - Translates verified workflow/event payloads into template-driven user notifications.
  - Maintains script-level assumptions for trigger source, payload fields, and recipient routing.

## Agent Interactions

- Contract Agent deploys/configures contracts and publishes ABI + interface compatibility notes.
- WordPress Agent consumes contract outputs to drive wallet-connected UI actions and plugin hooks.
- GoogleAppScript Agent consumes workflow/event data (typically through WordPress or backend mediation) to send transactional communications.

## Integration Guidelines

- Keep each agent responsibility modular and documented.
- Map every new feature to the owning agent before implementation.
- Reuse standardized contract events and ABI interfaces across plugin UI and automation components.
- Isolate WordPress-specific logic in PHP/plugin layers and keep JavaScript framework-agnostic.
- Keep automation scripts focused per workflow and document required payload fields/recipient logic.
- Document cross-agent dependencies whenever contract interfaces, plugin hooks, or receipt payloads change.

## Workflow Recommendations

1. Define the target user journey and identify the participating agents.
2. Specify required contract methods/events and corresponding plugin UI hooks.
3. Add compliance checkpoints for minting, transfers, rental events, and reporting.
4. Validate behavior in a staging environment before production rollout.
5. Maintain versioned integration notes whenever contract interfaces change.

## Module AGENTS References
- `SQMU/AGENTS.md` - contract and ABI module responsibilities, integration points, and change workflow.
- `WordpressPlugin/AGENTS.md` - WordPress plugin responsibilities and contract-integration guidance.
- `GoogleAppScript/AGENTS.md` - Google Apps Script receipt automation responsibilities and dependencies.
