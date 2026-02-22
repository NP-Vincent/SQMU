# SQMU Agent Model

## Overview

AGENTS are logical roles/components that interact with SQMU contracts and the WordPress plugin.
They define responsibilities and interactions for developers, operators, and end users.

## Core Agents

- **Owner Agent**
  - Controls contract deployment, upgrade planning, and initial system configuration.
  - Maintains authoritative references for deployed addresses and governance settings.

- **Asset Agent**
  - Handles asset onboarding, verification workflows, and SQMU token minting.
  - Publishes token metadata and ownership state changes through standard events.

- **R3NT Agent (Optional)**
  - Manages rental/payment lifecycle flows associated with tokenized assets.
  - Coordinates recurring and event-driven rental logic where enabled.

- **WordPress Agent**
  - Serves as the interface layer for administrators and users through the plugin UI.
  - Connects shortcode-driven widgets and wallet interactions to contract operations.

- **Compliance Agent**
  - Verifies process integrity, certification evidence, and reporting requirements.
  - Reviews on-chain/off-chain activity against applicable regulatory constraints.

## Agent Interactions

- Owner Agent deploys/configures contracts → Asset Agent mints and manages tokens.
- Asset Agent emits events → WordPress Agent surfaces updates in listing/portfolio experiences.
- Compliance Agent validates transaction and audit trails → R3NT Agent enforces rental logic when active.
- WordPress Agent captures user actions → routes approved operations to the appropriate on-chain contract functions.

## Integration Guidelines

- Keep each agent responsibility modular and documented.
- Map every new feature to the owning agent before implementation.
- Reuse standardized contract events and ABI interfaces across UI and automation components.
- Isolate WordPress-specific logic in PHP/plugin layers and keep JavaScript framework-agnostic.
- Document dependencies between agents, especially where compliance or payment workflows are involved.

## Workflow Recommendations

1. Define the target user journey and identify the participating agents.
2. Specify required contract methods/events and corresponding plugin UI hooks.
3. Add compliance checkpoints for minting, transfers, rental events, and reporting.
4. Validate behavior in a staging environment before production rollout.
5. Maintain versioned integration notes whenever contract interfaces change.
