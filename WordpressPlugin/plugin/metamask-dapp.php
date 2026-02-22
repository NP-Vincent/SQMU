<?php
/**
 * Plugin Name: MetaMask WordPress dApp
 * Description: Boots the MetaMask WordPress dApp assets and mount point.
 * Version: 0.1.0
 * Author: SQMU
 */

if (!defined('ABSPATH')) {
    exit;
}

function metamask_dapp_should_enqueue_widget_assets() {
    if (!empty($GLOBALS['sqmu_widget_needs_assets'])) {
        return true;
    }

    if (is_singular()) {
        global $post;
        if (!$post) {
            return false;
        }
        return has_shortcode($post->post_content, 'metamask_dapp')
            || has_shortcode($post->post_content, 'sqmu_listing')
            || has_shortcode($post->post_content, 'sqmu_portfolio');
    }

    return false;
}

function metamask_dapp_enqueue_assets() {
    $asset_file = plugin_dir_path(__FILE__) . 'assets/metamask-dapp.js';
    $asset_path = plugin_dir_url(__FILE__) . 'assets/metamask-dapp.js';
    $asset_version = file_exists($asset_file) ? filemtime($asset_file) : '0.1.0';

    wp_register_script('metamask-dapp', $asset_path, array(), $asset_version, true);

    $global_config = array(
        'chainId' => null
    );

    $mount_configs = isset($GLOBALS['metamask_dapp_mounts'])
        ? $GLOBALS['metamask_dapp_mounts']
        : array();

    $config = array(
        'global' => apply_filters('metamask_dapp_global_config', $global_config),
        'mounts' => $mount_configs
    );

    wp_add_inline_script(
        'metamask-dapp',
        'window.METAMASK_DAPP_CONFIG = ' . wp_json_encode($config) . ';',
        'before'
    );

    wp_add_inline_script(
        'metamask-dapp',
        'window.MetaMaskWP && window.MetaMaskWP.initMetaMaskDapp(window.METAMASK_DAPP_CONFIG || {});',
        'after'
    );

    if (metamask_dapp_should_enqueue_widget_assets()) {
        wp_enqueue_style(
            'sqmu-widgets',
            plugins_url('assets/sqmu-widgets.css', __FILE__),
            array(),
            '1.0.0'
        );
    }

    wp_enqueue_script('metamask-dapp');
}
add_action('wp_enqueue_scripts', 'metamask_dapp_enqueue_assets');

function metamask_dapp_register_mount($widget, $atts) {
    if (!isset($GLOBALS['metamask_dapp_mounts'])) {
        $GLOBALS['metamask_dapp_mounts'] = array();
    }

    if (array_key_exists('prefer_desktop', $atts)) {
        $atts['prefer_desktop'] = filter_var(
            $atts['prefer_desktop'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );
    }

    $mount_id = 'mmwp-' . wp_generate_uuid4();
    $config = array_filter(
        array(
            'chainId' => $atts['chain_id'] ?? null,
            'contractAddress' => $atts['contract_address'] ?? null,
            'rpcUrl' => $atts['rpc_url'] ?? null,
            'blockExplorerUrl' => $atts['block_explorer_url'] ?? null,
            'infuraApiKey' => $atts['infura_api_key'] ?? null,
            'dappName' => $atts['dapp_name'] ?? null,
            'dappUrl' => $atts['dapp_url'] ?? null,
            'chainName' => $atts['chain_name'] ?? null,
            'nativeCurrency' => $atts['native_currency'] ?? null,
            'propertyCode' => $atts['property_code'] ?? null,
            'tokenAddress' => $atts['token_address'] ?? null,
            'agentCode' => $atts['agent_code'] ?? null,
            'email' => $atts['email'] ?? null,
            'sqmuAddress' => $atts['sqmu'] ?? null,
            'distributorAddress' => $atts['distributor'] ?? null,
            'tradeAddress' => $atts['trade'] ?? null,
            'maxTokenId' => $atts['max_token_id'] ?? null,
            'sqmuDecimals' => $atts['sqmu_decimals'] ?? null,
            'enableSell' => $atts['enable_sell'] ?? null,
            'enableBuy' => $atts['enable_buy'] ?? null,
            'paymentTokens' => $atts['payment_tokens'] ?? null,
            'communicationLayerPreference' => $atts['communication_layer_preference'] ?? null,
            'preferDesktop' => $atts['prefer_desktop'] ?? null,
            'transport' => $atts['transport'] ?? null,
            'transports' => $atts['transports'] ?? null
        ),
        static function ($value) {
            return $value !== null && $value !== '';
        }
    );

    $GLOBALS['metamask_dapp_mounts'][$mount_id] = $config;
    $GLOBALS['sqmu_widget_needs_assets'] = true;

    $attributes = array(
        'id' => esc_attr($mount_id),
        'data-mmwp-widget' => esc_attr($widget),
        'class' => 'sqmu-widget'
    );

    foreach ($config as $key => $value) {
        if (!is_string($value) && !is_int($value) && !is_float($value)) {
            continue;
        }
        $attr_key = 'data-mmwp-' . strtolower(preg_replace('/([a-z])([A-Z])/', '$1-$2', $key));
        $attributes[$attr_key] = esc_attr($value);
    }

    $html = '<div';
    foreach ($attributes as $attr => $value) {
        $html .= sprintf(' %s="%s"', $attr, $value);
    }
    $html .= '></div>';

    return $html;
}

function metamask_dapp_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'chain_id' => '',
            'contract_address' => '',
            'rpc_url' => '',
            'infura_api_key' => '',
            'dapp_name' => '',
            'dapp_url' => '',
            'communication_layer_preference' => '',
            'prefer_desktop' => '',
            'transport' => '',
            'transports' => ''
        ),
        $atts,
        'metamask_dapp'
    );

    return metamask_dapp_register_mount('metamask-dapp', $atts);
}
add_shortcode('metamask_dapp', 'metamask_dapp_shortcode');

function sqmu_listing_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'chain_id' => '',
            'contract_address' => '',
            'rpc_url' => '',
            'infura_api_key' => '',
            'dapp_name' => '',
            'dapp_url' => '',
            'property_code' => '',
            'token_address' => '',
            'agent_code' => '',
            'email' => '',
            'communication_layer_preference' => '',
            'prefer_desktop' => '',
            'transport' => '',
            'transports' => ''
        ),
        $atts,
        'sqmu_listing'
    );

    return metamask_dapp_register_mount('sqmu-listing', $atts);
}
add_shortcode('sqmu_listing', 'sqmu_listing_shortcode');

function sqmu_portfolio_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'chain_id' => '',
            'rpc_url' => '',
            'block_explorer_url' => '',
            'chain_name' => '',
            'native_currency' => '',
            'sqmu' => '',
            'distributor' => '',
            'trade' => '',
            'max_token_id' => '',
            'sqmu_decimals' => '',
            'enable_sell' => '',
            'enable_buy' => '',
            'payment_token_allowlist' => '',
            'communication_layer_preference' => '',
            'prefer_desktop' => '',
            'transport' => '',
            'transports' => ''
        ),
        $atts,
        'sqmu_portfolio'
    );

    $normalize_bool = static function ($value) {
        if ($value === '' || $value === null) {
            return null;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    };

    $normalize_number = static function ($value) {
        if ($value === '' || $value === null) {
            return null;
        }
        if (!is_numeric($value)) {
            return null;
        }
        return (int) $value;
    };

    $atts['enable_sell'] = $normalize_bool($atts['enable_sell']);
    $atts['enable_buy'] = $normalize_bool($atts['enable_buy']);
    $atts['max_token_id'] = $normalize_number($atts['max_token_id']);
    $atts['sqmu_decimals'] = $normalize_number($atts['sqmu_decimals']);

    if (!empty($atts['payment_token_allowlist'])) {
        $tokens = preg_split('/[\s,]+/', $atts['payment_token_allowlist']);
        $tokens = array_filter(array_map('trim', $tokens));
        $atts['payment_tokens'] = $tokens ?: null;
    }

    return metamask_dapp_register_mount('sqmu-portfolio', $atts);
}
add_shortcode('sqmu_portfolio', 'sqmu_portfolio_shortcode');
