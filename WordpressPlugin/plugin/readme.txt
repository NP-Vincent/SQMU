=== SQMU WordPress Plugin ===
Contributors: sqmu
Tags: metamask, wallet, web3
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
Bootstraps the SQMU wallet application, provides admin-configured shortcode mounts for the current contract set, and adds a restricted browser-signed operations page for selected owner/admin actions.

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/sqmu.
2. Activate the plugin through the WordPress admin UI.
3. Go to Settings > SQMU App and configure chains, contracts, payment tokens, and view defaults using the add fields and editable tables.
4. Add the [sqmu_app] shortcode to a page.
5. Use Settings > SQMU Operations for restricted wallet-signed admin actions.

== Shortcode ==
[sqmu_app view="buy|portfolio|crowdfund|rent|rent_distribution|escrow" property_code="OPTIONAL_CODE" escrow_address="OPTIONAL_ADDRESS"]

== Property meta keys ==
_sqmu_property_code
_sqmu_token_id
_sqmu_token_address
_sqmu_property_id
_sqmu_property_ref

== Views ==
buy = distributor purchase flow
portfolio = holdings and secondary market workspace
crowdfund = governance purchase flow
rent = tenant/property rent actions
rent_distribution = read-only per-property rent balances
escrow = create or manage escrow instances

== Notes ==
- escrow_address is only used with view="escrow"
- rent_distribution is intentionally read-only in this release
- owner/admin actions intentionally exclude upgrades and ownership transfer

== Changelog ==
= 1.2.0 =
- Expanded the shortcode view surface to buy, portfolio, crowdfund, rent, rent distribution, and escrow.
- Added contract configuration for Crowdfund, Rent, Rent Distribution, and Escrow Factory.
- Added property meta support for property id and property ref.
- Added a restricted wp-admin operations page for selected browser-signed owner/admin actions.
