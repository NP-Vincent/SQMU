=== SQMU WordPress Plugin ===
Contributors: sqmu
Tags: metamask, wallet, web3
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
Bootstraps the SQMU wallet application and provides an admin-configured shortcode mount point.

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/sqmu.
2. Activate the plugin through the WordPress admin UI.
3. Go to Settings > SQMU App and configure chains, contracts, payment tokens, and view defaults.
4. Add the [sqmu_app] shortcode to a page.

== Shortcode ==
[sqmu_app view="buy|portfolio" property_code="OPTIONAL_CODE"]

== Property meta keys ==
_sqmu_property_code
_sqmu_token_id
_sqmu_token_address

== Changelog ==
= 1.1.0 =
- Replaced JSON shortcode configuration with admin-managed plugin settings and explicit property targeting.
