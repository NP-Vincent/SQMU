<?php
/**
 * Plugin Name: SQMU WordPress Plugin
 * Description: Boots the SQMU WordPress wallet application.
 * Version: 1.1.0
 * Author: SQMU
 */

if (!defined('ABSPATH')) {
    exit;
}

const SQMU_APP_OPTION_KEY = 'sqmu_app_settings';
const SQMU_PROPERTY_CODE_META_KEY = '_sqmu_property_code';
const SQMU_PROPERTY_TOKEN_ID_META_KEY = '_sqmu_token_id';
const SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY = '_sqmu_token_address';

function sqmu_app_default_settings() {
    return array(
        'version' => 1,
        'app' => array(
            'name' => 'SQMU Wallet',
            'url' => home_url('/'),
            'infuraApiKey' => ''
        ),
        'chains' => array(
            array(
                'id' => 59144,
                'name' => 'Linea',
                'rpcUrl' => '',
                'blockExplorerUrl' => 'https://lineascan.build',
                'nativeCurrency' => array(
                    'name' => 'Ether',
                    'symbol' => 'ETH',
                    'decimals' => 18
                )
            )
        ),
        'contracts' => array(
            'distributor' => '0x19d8D25DD4C85264B2AC502D66aEE113955b8A07',
            'trade' => '0x4F1BFDC7EBba77e7ec76C6AEbE81C0e84d28470B',
            'sqmu' => '0xd0b895e975f24045e43d788d42BD938b78666EC8'
        ),
        'paymentTokens' => array(
            array(
                'address' => '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
                'symbol' => 'USDC',
                'decimals' => 6
            ),
            array(
                'address' => '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
                'symbol' => 'USDT',
                'decimals' => 6
            )
        ),
        'viewDefaults' => array(
            'buy' => array(
                'defaultChainId' => 59144,
                'features' => array(
                    'buy' => true,
                    'listing' => true,
                    'portfolio' => true,
                    'sell' => false
                )
            ),
            'listing' => array(
                'defaultChainId' => 59144,
                'features' => array(
                    'buy' => true,
                    'listing' => true,
                    'portfolio' => true,
                    'sell' => true
                )
            ),
            'portfolio' => array(
                'defaultChainId' => 59144,
                'features' => array(
                    'buy' => true,
                    'listing' => true,
                    'portfolio' => true,
                    'sell' => false
                )
            )
        )
    );
}

function sqmu_app_allowed_views() {
    return array('buy', 'listing', 'portfolio');
}

function sqmu_app_get_settings() {
    $defaults = sqmu_app_default_settings();
    $saved = get_option(SQMU_APP_OPTION_KEY, array());

    if (!is_array($saved)) {
        $saved = array();
    }

    $settings = array_replace_recursive($defaults, $saved);
    $settings['version'] = 1;

    return $settings;
}

function sqmu_app_parse_json_textarea($value, $fallback) {
    if (!is_string($value) || trim($value) === '') {
        return $fallback;
    }

    $decoded = json_decode(wp_unslash($value), true);
    return is_array($decoded) ? $decoded : $fallback;
}

function sqmu_app_sanitize_bool($value, $default = false) {
    if (is_bool($value)) {
        return $value;
    }

    if ($value === null || $value === '') {
        return $default;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function sqmu_app_sanitize_view_defaults($input, $defaults) {
    $output = array();
    foreach (sqmu_app_allowed_views() as $view) {
        $view_input = isset($input[$view]) && is_array($input[$view]) ? $input[$view] : array();
        $view_defaults = $defaults[$view];

        $features_input = isset($view_input['features']) && is_array($view_input['features'])
            ? $view_input['features']
            : array();

        $output[$view] = array(
            'defaultChainId' => isset($view_input['defaultChainId']) && $view_input['defaultChainId'] !== ''
                ? (int) $view_input['defaultChainId']
                : (int) $view_defaults['defaultChainId'],
            'features' => array(
                'buy' => sqmu_app_sanitize_bool($features_input['buy'] ?? null, $view_defaults['features']['buy']),
                'listing' => sqmu_app_sanitize_bool($features_input['listing'] ?? null, $view_defaults['features']['listing']),
                'portfolio' => sqmu_app_sanitize_bool($features_input['portfolio'] ?? null, $view_defaults['features']['portfolio']),
                'sell' => sqmu_app_sanitize_bool($features_input['sell'] ?? null, $view_defaults['features']['sell'])
            )
        );
    }

    return $output;
}

function sqmu_app_sanitize_settings($input) {
    $defaults = sqmu_app_default_settings();

    if (!is_array($input)) {
        return $defaults;
    }

    $app_input = isset($input['app']) && is_array($input['app']) ? $input['app'] : array();
    $contracts_input = isset($input['contracts']) && is_array($input['contracts']) ? $input['contracts'] : array();

    return array(
        'version' => 1,
        'app' => array(
            'name' => sanitize_text_field($app_input['name'] ?? $defaults['app']['name']),
            'url' => esc_url_raw($app_input['url'] ?? $defaults['app']['url']),
            'infuraApiKey' => sanitize_text_field($app_input['infuraApiKey'] ?? '')
        ),
        'chains' => sqmu_app_parse_json_textarea($input['chains_json'] ?? '', $defaults['chains']),
        'contracts' => array(
            'distributor' => sanitize_text_field($contracts_input['distributor'] ?? $defaults['contracts']['distributor']),
            'trade' => sanitize_text_field($contracts_input['trade'] ?? $defaults['contracts']['trade']),
            'sqmu' => sanitize_text_field($contracts_input['sqmu'] ?? $defaults['contracts']['sqmu'])
        ),
        'paymentTokens' => sqmu_app_parse_json_textarea($input['payment_tokens_json'] ?? '', $defaults['paymentTokens']),
        'viewDefaults' => sqmu_app_sanitize_view_defaults($input['viewDefaults'] ?? array(), $defaults['viewDefaults'])
    );
}

function sqmu_app_register_settings() {
    register_setting(
        'sqmu_app_settings_group',
        SQMU_APP_OPTION_KEY,
        array(
            'type' => 'array',
            'sanitize_callback' => 'sqmu_app_sanitize_settings',
            'default' => sqmu_app_default_settings()
        )
    );
}
add_action('admin_init', 'sqmu_app_register_settings');

function sqmu_app_admin_menu() {
    add_options_page(
        'SQMU App',
        'SQMU App',
        'manage_options',
        'sqmu-app',
        'sqmu_app_render_settings_page'
    );
}
add_action('admin_menu', 'sqmu_app_admin_menu');

function sqmu_app_render_checkbox($name, $checked) {
    printf(
        '<label><input type="checkbox" name="%s" value="1" %s /> Enabled</label>',
        esc_attr($name),
        checked($checked, true, false)
    );
}

function sqmu_app_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $settings = sqmu_app_get_settings();
    ?>
    <div class="wrap">
        <h1>SQMU App Settings</h1>
        <p>Configure accepted chains, contract addresses, payment tokens, and per-view defaults for the shortcode-driven wallet application.</p>
        <p><strong>Property meta keys:</strong> <code><?php echo esc_html(SQMU_PROPERTY_CODE_META_KEY); ?></code>, <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ID_META_KEY); ?></code>, <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY); ?></code></p>
        <form method="post" action="options.php">
            <?php settings_fields('sqmu_app_settings_group'); ?>

            <h2>Application</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sqmu-app-name">App name</label></th>
                    <td><input id="sqmu-app-name" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[app][name]" type="text" class="regular-text" value="<?php echo esc_attr($settings['app']['name']); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-app-url">App URL</label></th>
                    <td><input id="sqmu-app-url" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[app][url]" type="url" class="regular-text" value="<?php echo esc_attr($settings['app']['url']); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-app-infura">Infura API key</label></th>
                    <td><input id="sqmu-app-infura" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[app][infuraApiKey]" type="text" class="regular-text" value="<?php echo esc_attr($settings['app']['infuraApiKey']); ?>" /></td>
                </tr>
            </table>

            <h2>Contracts</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sqmu-contract-distributor">Distributor</label></th>
                    <td><input id="sqmu-contract-distributor" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[contracts][distributor]" type="text" class="regular-text code" value="<?php echo esc_attr($settings['contracts']['distributor']); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-contract-trade">Trade</label></th>
                    <td><input id="sqmu-contract-trade" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[contracts][trade]" type="text" class="regular-text code" value="<?php echo esc_attr($settings['contracts']['trade']); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-contract-sqmu">SQMU</label></th>
                    <td><input id="sqmu-contract-sqmu" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[contracts][sqmu]" type="text" class="regular-text code" value="<?php echo esc_attr($settings['contracts']['sqmu']); ?>" /></td>
                </tr>
            </table>

            <h2>Accepted chains</h2>
            <p>Enter a JSON array. Each chain should include <code>id</code>, <code>name</code>, <code>rpcUrl</code>, <code>blockExplorerUrl</code>, and <code>nativeCurrency</code>.</p>
            <textarea name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[chains_json]" rows="12" class="large-text code"><?php echo esc_textarea(wp_json_encode($settings['chains'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></textarea>

            <h2>Payment tokens</h2>
            <p>Enter a JSON array. Each payment token should include <code>address</code>, <code>symbol</code>, and <code>decimals</code>.</p>
            <textarea name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[payment_tokens_json]" rows="10" class="large-text code"><?php echo esc_textarea(wp_json_encode($settings['paymentTokens'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></textarea>

            <h2>Per-view defaults</h2>
            <table class="form-table" role="presentation">
                <?php foreach (sqmu_app_allowed_views() as $view) : ?>
                    <tr>
                        <th scope="row"><?php echo esc_html(ucfirst($view)); ?></th>
                        <td>
                            <p>
                                <label>
                                    Default chain ID
                                    <input
                                        name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[viewDefaults][<?php echo esc_attr($view); ?>][defaultChainId]"
                                        type="number"
                                        class="small-text"
                                        value="<?php echo esc_attr($settings['viewDefaults'][$view]['defaultChainId']); ?>"
                                    />
                                </label>
                            </p>
                            <p>
                                <?php sqmu_app_render_checkbox(SQMU_APP_OPTION_KEY . "[viewDefaults][{$view}][features][buy]", $settings['viewDefaults'][$view]['features']['buy']); ?>
                                <?php echo ' '; ?>
                                <span>Buy</span>
                            </p>
                            <p>
                                <?php sqmu_app_render_checkbox(SQMU_APP_OPTION_KEY . "[viewDefaults][{$view}][features][listing]", $settings['viewDefaults'][$view]['features']['listing']); ?>
                                <?php echo ' '; ?>
                                <span>Listings</span>
                            </p>
                            <p>
                                <?php sqmu_app_render_checkbox(SQMU_APP_OPTION_KEY . "[viewDefaults][{$view}][features][portfolio]", $settings['viewDefaults'][$view]['features']['portfolio']); ?>
                                <?php echo ' '; ?>
                                <span>Portfolio</span>
                            </p>
                            <p>
                                <?php sqmu_app_render_checkbox(SQMU_APP_OPTION_KEY . "[viewDefaults][{$view}][features][sell]", $settings['viewDefaults'][$view]['features']['sell']); ?>
                                <?php echo ' '; ?>
                                <span>Sell</span>
                            </p>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </table>

            <?php submit_button('Save SQMU Settings'); ?>
        </form>
    </div>
    <?php
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

function sqmu_app_get_runtime_global_config() {
    $settings = sqmu_app_get_settings();

    return array(
        'version' => 1,
        'app' => array(
            'name' => $settings['app']['name'] ?: get_bloginfo('name'),
            'url' => $settings['app']['url'] ?: home_url('/'),
            'infuraApiKey' => $settings['app']['infuraApiKey']
        ),
        'chains' => $settings['chains'],
        'contracts' => $settings['contracts'],
        'paymentTokens' => $settings['paymentTokens'],
        'viewDefaults' => $settings['viewDefaults']
    );
}

function sqmu_app_enqueue_assets() {
    if (!sqmu_app_should_enqueue_assets()) {
        return;
    }

    $asset_file = plugin_dir_path(__FILE__) . 'assets/sqmu.js';
    $asset_path = plugin_dir_url(__FILE__) . 'assets/sqmu.js';
    $asset_version = file_exists($asset_file) ? filemtime($asset_file) : '1.1.0';

    wp_register_script('sqmu', $asset_path, array(), $asset_version, true);

    $mount_configs = isset($GLOBALS['sqmu_app_mounts'])
        ? $GLOBALS['sqmu_app_mounts']
        : array();

    $config = array(
        'global' => apply_filters('sqmu_app_global_config', sqmu_app_get_runtime_global_config()),
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
        '1.1.0'
    );

    wp_enqueue_script('sqmu');
}
add_action('wp_enqueue_scripts', 'sqmu_app_enqueue_assets');

function sqmu_app_find_property_by_code($property_code) {
    $property_code = sanitize_text_field($property_code);

    if ($property_code === '') {
        return array(
            'property' => null,
            'errors' => array()
        );
    }

    $posts = get_posts(
        array(
            'post_type' => 'any',
            'post_status' => 'publish',
            'posts_per_page' => 2,
            'meta_query' => array(
                array(
                    'key' => SQMU_PROPERTY_CODE_META_KEY,
                    'value' => $property_code
                )
            )
        )
    );

    if (!$posts) {
        return array(
            'property' => null,
            'errors' => array(
                sprintf('Property code "%s" could not be resolved from WordPress content.', $property_code)
            )
        );
    }

    if (count($posts) > 1) {
        return array(
            'property' => null,
            'errors' => array(
                sprintf('Property code "%s" matched multiple WordPress posts. Property codes must be unique.', $property_code)
            )
        );
    }

    $post = $posts[0];
    $token_id = get_post_meta($post->ID, SQMU_PROPERTY_TOKEN_ID_META_KEY, true);
    $token_address = get_post_meta($post->ID, SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY, true);
    $errors = array();

    if ($token_id === '' || !is_numeric($token_id)) {
        $errors[] = sprintf(
            'Property "%s" is missing a numeric %s post meta value.',
            $property_code,
            SQMU_PROPERTY_TOKEN_ID_META_KEY
        );
    }

    if ($token_address === '') {
        $errors[] = sprintf(
            'Property "%s" is missing a %s post meta value.',
            $property_code,
            SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY
        );
    }

    return array(
        'property' => array(
            'propertyCode' => $property_code,
            'tokenId' => $token_id !== '' && is_numeric($token_id) ? (int) $token_id : null,
            'tokenAddress' => sanitize_text_field($token_address),
            'postId' => (int) $post->ID,
            'postTitle' => get_the_title($post)
        ),
        'errors' => $errors
    );
}

function sqmu_app_build_mount_config($view, $property_code) {
    $settings = sqmu_app_get_settings();
    $view_defaults = isset($settings['viewDefaults'][$view]) && is_array($settings['viewDefaults'][$view])
        ? $settings['viewDefaults'][$view]
        : $settings['viewDefaults']['buy'];

    $property_result = sqmu_app_find_property_by_code($property_code);
    $property = $property_result['property'];
    $errors = $property_result['errors'];

    $config = array(
        'version' => 1,
        'app' => $settings['app'],
        'chains' => $settings['chains'],
        'defaultChainId' => (int) ($view_defaults['defaultChainId'] ?? 0),
        'contracts' => $settings['contracts'],
        'paymentTokens' => $settings['paymentTokens'],
        'properties' => $property ? array($property) : array(),
        'features' => $view_defaults['features'],
        'propertyCode' => $property_code !== '' ? $property_code : null
    );

    if ($property_code !== '' && !$property) {
        $config['properties'] = array();
    }

    return array(
        'view' => $view,
        'config' => $config,
        'errors' => $errors
    );
}

function sqmu_app_register_mount($atts) {
    if (!isset($GLOBALS['sqmu_app_mounts'])) {
        $GLOBALS['sqmu_app_mounts'] = array();
    }

    $view = isset($atts['view']) ? sanitize_key($atts['view']) : 'buy';
    if (!in_array($view, sqmu_app_allowed_views(), true)) {
        $view = 'buy';
    }

    $property_code = sanitize_text_field($atts['property_code'] ?? '');
    $mount_config = sqmu_app_build_mount_config($view, $property_code);

    $mount_id = 'sqmu-app-' . wp_generate_uuid4();
    $GLOBALS['sqmu_app_mounts'][$mount_id] = $mount_config;
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
            'property_code' => ''
        ),
        $atts,
        'sqmu_app'
    );

    return sqmu_app_register_mount($atts);
}
add_shortcode('sqmu_app', 'sqmu_app_shortcode');
