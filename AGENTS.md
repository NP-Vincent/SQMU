# SQMU Agent Model

## Overview

AGENTS are logical roles/components that interact with SQMU contracts and the WordPress plugin.
They define responsibilities and interactions for developers, operators, and end users.

## Core Agents

- **Contract Agent**
  - Controls contract deployment, upgrade planning, and initial system configuration.
  - Maintains authoritative references for deployed addresses and governance settings.

- **WordPress Agent**
  - Serves as the interface layer for administrators and users through the plugin UI.
  - Connects shortcode-driven widgets and wallet interactions to contract operations.

## Agent Interactions

- Contract Agent deploys/configures contracts -> provides ABI and other interactive elements
- WordPress Agent captures user actions

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
