=== SQMU WordPress Plugin ===
Contributors: sqmu
Tags: metamask, wallet, web3
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
Bootstraps the SQMU wallet application and provides a shortcode mount point.

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/sqmu.
2. Activate the plugin through the WordPress admin UI.
3. Add the [sqmu_app] shortcode to a page.

== Shortcode ==
[sqmu_app view="buy|listing|portfolio" config='{"version":1,"chains":[...],"contracts":{...}}']

== Changelog ==
= 1.0.0 =
- Rebuilt the plugin frontend as a React + Wagmi wallet application.
