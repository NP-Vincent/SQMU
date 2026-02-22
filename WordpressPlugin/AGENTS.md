# WordPress Plugin Agent Guide

## Purpose
This folder provides the WordPress integration layer for SQMU wallet and asset workflows.
It maps shortcode-rendered UI components to contract operations while keeping WordPress-specific behavior inside plugin PHP code.

## Owning Agent
- **WordPress Agent** (primary owner)
  - Exposes administrator and end-user interaction points in WordPress.
  - Connects wallet actions and UI events to contract methods/events.

## Responsibilities in this folder
- Keep shortcode/widget mounting stable (`metamask_dapp`, `sqmu_listing`, `sqmu_portfolio`).
- Keep JavaScript framework-agnostic and focused on contract interaction behavior.
- Keep WordPress-specific routing/configuration in PHP/plugin boundaries.
- Track dependencies on contract ABI/event changes and version notes.

## Integration points
- Depends on **Contract Agent** outputs (deployed addresses, ABI compatibility, event semantics).
- Can trigger/support **GoogleAppScript Agent** communication workflows via backend hooks for receipts or notifications.

## Change workflow
1. Map user journey and identify shortcode/widget touchpoints.
2. Confirm required contract methods/events and plugin hooks.
3. Implement UI + plugin changes with clear separation of concerns.
4. Validate in a WordPress staging environment with wallet flows.
5. Document integration/version updates.
