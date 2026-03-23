<?php
/**
 * Plugin Name: SQMU WordPress Plugin
 * Description: Boots the SQMU WordPress wallet application.
 * Version: 1.0.0
 * Author: SQMU
 */

if (!defined('ABSPATH')) {
    exit;
}

function sqmu_app_should_enqueue_assets() {
    if (!empty($GLOBALS['sqmu_app_needs_assets'])) {
        return true;
    }

    if (is_singular()) {
        global $post;
        if (!$post) {
            return false;
        }
        return has_shortcode($post->post_content, 'sqmu_app');
    }

    return false;
}

function sqmu_app_enqueue_assets() {
    if (!sqmu_app_should_enqueue_assets()) {
        return;
    }

    $asset_file = plugin_dir_path(__FILE__) . 'assets/sqmu.js';
    $asset_path = plugin_dir_url(__FILE__) . 'assets/sqmu.js';
    $asset_version = file_exists($asset_file) ? filemtime($asset_file) : '1.0.0';

    wp_register_script('sqmu', $asset_path, array(), $asset_version, true);

    $global_config = array(
        'version' => 1,
        'app' => array(
            'name' => get_bloginfo('name'),
            'url' => home_url('/')
        )
    );

    $mount_configs = isset($GLOBALS['sqmu_app_mounts'])
        ? $GLOBALS['sqmu_app_mounts']
        : array();

    $config = array(
        'global' => apply_filters('sqmu_app_global_config', $global_config),
        'mounts' => $mount_configs
    );

    wp_add_inline_script(
        'sqmu',
        'window.SQMU_CONFIG = ' . wp_json_encode($config) . ';',
        'before'
    );

    wp_add_inline_script(
        'sqmu',
        '(function(){ if (window.SQMUWP && typeof window.SQMUWP.initSQMU === "function") { window.SQMUWP.initSQMU(window.SQMU_CONFIG || {}); } })();',
        'after'
    );

    wp_enqueue_style(
        'sqmu-widgets',
        plugins_url('assets/sqmu-widgets.css', __FILE__),
        array(),
        '1.0.0'
    );

    wp_enqueue_script('sqmu');
}
add_action('wp_enqueue_scripts', 'sqmu_app_enqueue_assets');

function sqmu_app_parse_json_config($value) {
    if (!is_string($value) || trim($value) === '') {
        return array();
    }

    $decoded = json_decode(wp_unslash($value), true);
    return is_array($decoded) ? $decoded : null;
}

function sqmu_app_register_mount($atts) {
    if (!isset($GLOBALS['sqmu_app_mounts'])) {
        $GLOBALS['sqmu_app_mounts'] = array();
    }

    $view = isset($atts['view']) ? sanitize_key($atts['view']) : 'buy';
    $allowed_views = array('buy', 'listing', 'portfolio');
    if (!in_array($view, $allowed_views, true)) {
        $view = 'buy';
    }

    $config = sqmu_app_parse_json_config($atts['config'] ?? '');
    if ($config === null) {
        return '<div class="sqmu-widget sqmu-widget-error">SQMU app configuration is invalid JSON.</div>';
    }

    $mount_id = 'sqmu-app-' . wp_generate_uuid4();
    $GLOBALS['sqmu_app_mounts'][$mount_id] = array(
        'view' => $view,
        'config' => $config
    );
    $GLOBALS['sqmu_app_needs_assets'] = true;

    $attributes = array(
        'id' => esc_attr($mount_id),
        'data-sqmu-app' => '1',
        'data-sqmu-view' => esc_attr($view),
        'class' => 'sqmu-widget wp-block-group is-layout-flow'
    );

    $html = '<div';
    foreach ($attributes as $attr => $value) {
        $html .= sprintf(' %s="%s"', $attr, $value);
    }
    $html .= '></div>';

    return $html;
}

function sqmu_app_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'view' => 'buy',
            'config' => ''
        ),
        $atts,
        'sqmu_app'
    );

    return sqmu_app_register_mount($atts);
}
add_shortcode('sqmu_app', 'sqmu_app_shortcode');
