<?php
/**
 * Plugin Name: SQMU WordPress Plugin
 * Description: Boots the SQMU WordPress wallet application.
 * Version: 1.2.0
 * Author: SQMU
 */

if (!defined('ABSPATH')) {
    exit;
}

const SQMU_APP_OPTION_KEY = 'sqmu_app_settings';
const SQMU_PROPERTY_CODE_META_KEY = '_sqmu_property_code';
const SQMU_PROPERTY_TOKEN_ID_META_KEY = '_sqmu_token_id';
const SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY = '_sqmu_token_address';
const SQMU_PROPERTY_ID_META_KEY = '_sqmu_property_id';
const SQMU_PROPERTY_REF_META_KEY = '_sqmu_property_ref';

function sqmu_app_contract_labels() {
    return array(
        'distributor' => 'Distributor',
        'trade' => 'Trade',
        'sqmu' => 'SQMU',
        'crowdfund' => 'Crowdfund',
        'rent' => 'Rent',
        'rentDistribution' => 'Rent Distribution',
        'escrowFactory' => 'Escrow Factory'
    );
}

function sqmu_app_allowed_views() {
    return array('buy', 'portfolio', 'crowdfund', 'rent', 'rent_distribution', 'escrow');
}

function sqmu_app_default_view_defaults() {
    return array(
        'buy' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => true,
                'portfolio' => true,
                'sell' => false
            )
        ),
        'portfolio' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => true,
                'portfolio' => true,
                'sell' => true
            )
        ),
        'crowdfund' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => true,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'rent' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => false,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'rent_distribution' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => false,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'escrow' => array(
            'defaultChainId' => 534352,
            'features' => array(
                'buy' => false,
                'portfolio' => false,
                'sell' => false
            )
        )
    );
}

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
                'id' => 534352,
                'name' => 'Scroll',
                'rpcUrl' => '',
                'blockExplorerUrl' => 'https://scrollscan.com',
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
            'sqmu' => '0xd0b895e975f24045e43d788d42BD938b78666EC8',
            'crowdfund' => '0xD759dA420768E62026025516655D0E33b81773cC',
            'rent' => '0x85490cC86e4fDBC2AC1e853a96bf80Bea89c0ff8',
            'rentDistribution' => '0x361516487722cAb8eBEc5Faf2f1Fa156098a4DE6',
            'escrowFactory' => ''
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
            ),
            array(
                'address' => '0xdb9E8F82D6d45fFf803161F2a5f75543972B229a',
                'symbol' => 'USDQ',
                'decimals' => 18
            )
        ),
        'viewDefaults' => sqmu_app_default_view_defaults()
    );
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
                'portfolio' => sqmu_app_sanitize_bool($features_input['portfolio'] ?? null, $view_defaults['features']['portfolio']),
                'sell' => sqmu_app_sanitize_bool($features_input['sell'] ?? null, $view_defaults['features']['sell'])
            )
        );
    }

    return $output;
}

function sqmu_app_sanitize_contracts($contracts_input, $defaults) {
    $contracts = array();
    foreach (array_keys(sqmu_app_contract_labels()) as $key) {
        $contracts[$key] = sanitize_text_field($contracts_input[$key] ?? $defaults[$key]);
    }
    return $contracts;
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
        'contracts' => sqmu_app_sanitize_contracts($contracts_input, $defaults['contracts']),
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

    $operations_hook = add_submenu_page(
        'options-general.php',
        'SQMU Operations',
        'SQMU Operations',
        'manage_options',
        'sqmu-app-operations',
        'sqmu_app_render_operations_page'
    );

    if ($operations_hook) {
        $GLOBALS['sqmu_app_operations_hook'] = $operations_hook;
    }
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
        <p><strong>Property meta keys:</strong>
            <code><?php echo esc_html(SQMU_PROPERTY_CODE_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ID_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_ID_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_REF_META_KEY); ?></code>
        </p>
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
                <?php foreach (sqmu_app_contract_labels() as $key => $label) : ?>
                    <tr>
                        <th scope="row"><label for="sqmu-contract-<?php echo esc_attr($key); ?>"><?php echo esc_html($label); ?></label></th>
                        <td><input id="sqmu-contract-<?php echo esc_attr($key); ?>" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[contracts][<?php echo esc_attr($key); ?>]" type="text" class="regular-text code" value="<?php echo esc_attr($settings['contracts'][$key]); ?>" /></td>
                    </tr>
                <?php endforeach; ?>
            </table>

            <h2>Accepted chains</h2>
            <p>Enter a JSON array. Each chain should include <code>id</code>, <code>name</code>, <code>rpcUrl</code>, <code>blockExplorerUrl</code>, and <code>nativeCurrency</code>.</p>
            <textarea name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[chains_json]" rows="12" class="large-text code"><?php echo esc_textarea(wp_json_encode($settings['chains'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></textarea>

            <h2>Payment tokens</h2>
            <p>Enter a JSON array. Each payment token should include <code>address</code>, <code>symbol</code>, and <code>decimals</code>.</p>
            <textarea name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[payment_tokens_json]" rows="12" class="large-text code"><?php echo esc_textarea(wp_json_encode($settings['paymentTokens'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></textarea>

            <h2>Per-view defaults</h2>
            <table class="form-table" role="presentation">
                <?php foreach (sqmu_app_allowed_views() as $view) : ?>
                    <tr>
                        <th scope="row"><?php echo esc_html(ucwords(str_replace('_', ' ', $view))); ?></th>
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

function sqmu_app_render_operations_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    echo '<div class="wrap">';
    echo '<h1>SQMU Operations</h1>';
    echo '<p>Owner and admin contract operations are signed by the connected wallet in your browser. Upgrade and ownership transfer actions are intentionally excluded from this interface.</p>';
    echo '<div id="sqmu-admin-ops" data-sqmu-app="1" data-sqmu-view="admin_ops" class="sqmu-widget wp-block-group is-layout-flow"></div>';
    echo '</div>';
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

function sqmu_app_is_valid_bytes32($value) {
    return is_string($value) && preg_match('/^0x[a-fA-F0-9]{64}$/', trim($value)) === 1;
}

function sqmu_app_build_property_record($post) {
    $property_code = sanitize_text_field(get_post_meta($post->ID, SQMU_PROPERTY_CODE_META_KEY, true));
    $token_id = get_post_meta($post->ID, SQMU_PROPERTY_TOKEN_ID_META_KEY, true);
    $token_address = sanitize_text_field(get_post_meta($post->ID, SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY, true));
    $property_id = get_post_meta($post->ID, SQMU_PROPERTY_ID_META_KEY, true);
    $property_ref = sanitize_text_field(get_post_meta($post->ID, SQMU_PROPERTY_REF_META_KEY, true));

    return array(
        'propertyCode' => $property_code,
        'tokenId' => $token_id !== '' && is_numeric($token_id) ? (int) $token_id : null,
        'tokenAddress' => $token_address,
        'propertyId' => $property_id !== '' && is_numeric($property_id) ? (int) $property_id : null,
        'propertyRef' => sqmu_app_is_valid_bytes32($property_ref) ? $property_ref : null,
        'postId' => (int) $post->ID,
        'postTitle' => get_the_title($post)
    );
}

function sqmu_app_get_property_catalog() {
    static $catalog = null;

    if ($catalog !== null) {
        return $catalog;
    }

    $posts = get_posts(
        array(
            'post_type' => 'any',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => SQMU_PROPERTY_CODE_META_KEY,
                    'compare' => 'EXISTS'
                )
            ),
            'orderby' => 'title',
            'order' => 'ASC'
        )
    );

    $properties = array();
    $duplicates = array();
    $seen = array();

    foreach ($posts as $post) {
        $record = sqmu_app_build_property_record($post);
        if ($record['propertyCode'] === '') {
            continue;
        }

        if (isset($seen[$record['propertyCode']])) {
            $duplicates[$record['propertyCode']] = true;
            continue;
        }

        $seen[$record['propertyCode']] = true;
        $properties[] = $record;
    }

    $catalog = array(
        'properties' => $properties,
        'duplicateCodes' => array_keys($duplicates)
    );

    return $catalog;
}

function sqmu_app_find_property_by_code($property_code) {
    $catalog = sqmu_app_get_property_catalog();
    $property_code = sanitize_text_field($property_code);

    if ($property_code === '') {
        return array(
            'property' => null,
            'errors' => array()
        );
    }

    if (in_array($property_code, $catalog['duplicateCodes'], true)) {
        return array(
            'property' => null,
            'errors' => array(
                sprintf('Property code "%s" matched multiple WordPress posts. Property codes must be unique.', $property_code)
            )
        );
    }

    foreach ($catalog['properties'] as $property) {
        if ($property['propertyCode'] === $property_code) {
            return array(
                'property' => $property,
                'errors' => array()
            );
        }
    }

    return array(
        'property' => null,
        'errors' => array(
            sprintf('Property code "%s" could not be resolved from WordPress content.', $property_code)
        )
    );
}

function sqmu_app_validate_property_for_view($property, $view) {
    $errors = array();

    if (!$property) {
        return $errors;
    }

    if (in_array($view, array('buy', 'portfolio'), true)) {
        if ($property['tokenId'] === null) {
            $errors[] = sprintf(
                'Property "%s" is missing a numeric %s post meta value.',
                $property['propertyCode'],
                SQMU_PROPERTY_TOKEN_ID_META_KEY
            );
        }
        if ($property['tokenAddress'] === '') {
            $errors[] = sprintf(
                'Property "%s" is missing a %s post meta value.',
                $property['propertyCode'],
                SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY
            );
        }
    }

    if (in_array($view, array('rent', 'rent_distribution'), true) && $property['propertyId'] === null) {
        $errors[] = sprintf(
            'Property "%s" is missing a numeric %s post meta value.',
            $property['propertyCode'],
            SQMU_PROPERTY_ID_META_KEY
        );
    }

    if ($view === 'escrow' && empty($property['propertyRef'])) {
        $errors[] = sprintf(
            'Property "%s" is missing a valid %s post meta value.',
            $property['propertyCode'],
            SQMU_PROPERTY_REF_META_KEY
        );
    }

    return $errors;
}

function sqmu_app_get_runtime_global_config($context = 'public') {
    $settings = sqmu_app_get_settings();
    $catalog = sqmu_app_get_property_catalog();

    return array(
        'version' => 1,
        'context' => $context,
        'app' => array(
            'name' => $settings['app']['name'] ?: get_bloginfo('name'),
            'url' => $settings['app']['url'] ?: home_url('/'),
            'infuraApiKey' => $settings['app']['infuraApiKey']
        ),
        'currentUser' => array(
            'canManageOptions' => current_user_can('manage_options')
        ),
        'chains' => $settings['chains'],
        'contracts' => $settings['contracts'],
        'paymentTokens' => $settings['paymentTokens'],
        'viewDefaults' => $settings['viewDefaults'],
        'properties' => $catalog['properties']
    );
}

function sqmu_app_build_mount_config($view, $property_code, $escrow_address = '', $context = 'public') {
    $settings = sqmu_app_get_settings();
    $view_defaults = isset($settings['viewDefaults'][$view]) && is_array($settings['viewDefaults'][$view])
        ? $settings['viewDefaults'][$view]
        : $settings['viewDefaults']['buy'];

    $catalog = sqmu_app_get_property_catalog();
    $property_result = sqmu_app_find_property_by_code($property_code);
    $selected_property = $property_result['property'];
    $errors = $property_result['errors'];
    $properties = $selected_property ? array($selected_property) : $catalog['properties'];

    if ($selected_property) {
        $errors = array_merge($errors, sqmu_app_validate_property_for_view($selected_property, $view));
    }

    $config = array(
        'version' => 1,
        'context' => $context,
        'app' => $settings['app'],
        'currentUser' => array(
            'canManageOptions' => current_user_can('manage_options')
        ),
        'chains' => $settings['chains'],
        'defaultChainId' => (int) ($view_defaults['defaultChainId'] ?? 0),
        'contracts' => $settings['contracts'],
        'paymentTokens' => $settings['paymentTokens'],
        'properties' => $properties,
        'features' => $view_defaults['features'],
        'propertyCode' => $property_code !== '' ? $property_code : null,
        'escrowAddress' => $view === 'escrow' && $escrow_address !== '' ? sanitize_text_field($escrow_address) : null
    );

    return array(
        'view' => $view,
        'config' => $config,
        'errors' => array_values(array_unique(array_filter($errors)))
    );
}

function sqmu_app_register_script_assets() {
    $asset_file = plugin_dir_path(__FILE__) . 'assets/sqmu.js';
    $asset_path = plugin_dir_url(__FILE__) . 'assets/sqmu.js';
    $asset_version = file_exists($asset_file) ? filemtime($asset_file) : '1.2.0';

    wp_register_script('sqmu', $asset_path, array(), $asset_version, true);
    wp_register_style(
        'sqmu-widgets',
        plugins_url('assets/sqmu-widgets.css', __FILE__),
        array(),
        $asset_version
    );
}

function sqmu_app_module_script_tag($tag, $handle, $src) {
    if ($handle !== 'sqmu') {
        return $tag;
    }

    if (strpos($tag, 'type=') !== false) {
        return (string) preg_replace('/type=("|\')[^"\']*("|\')/', 'type="module"', $tag, 1);
    }

    return str_replace('<script ', '<script type="module" ', $tag);
}
add_filter('script_loader_tag', 'sqmu_app_module_script_tag', 10, 3);

function sqmu_app_enqueue_runtime_payload($payload) {
    sqmu_app_register_script_assets();

    wp_add_inline_script(
        'sqmu',
        'window.SQMU_CONFIG = ' . wp_json_encode($payload) . ';',
        'before'
    );

    wp_enqueue_style('sqmu-widgets');
    wp_enqueue_script('sqmu');
}

function sqmu_app_enqueue_assets() {
    if (!sqmu_app_should_enqueue_assets()) {
        return;
    }

    $mount_configs = isset($GLOBALS['sqmu_app_mounts'])
        ? $GLOBALS['sqmu_app_mounts']
        : array();

    $payload = array(
        'global' => apply_filters('sqmu_app_global_config', sqmu_app_get_runtime_global_config('public')),
        'mounts' => $mount_configs
    );

    sqmu_app_enqueue_runtime_payload($payload);
}
add_action('wp_enqueue_scripts', 'sqmu_app_enqueue_assets');

function sqmu_app_enqueue_admin_assets($hook_suffix) {
    $operations_hook = $GLOBALS['sqmu_app_operations_hook'] ?? '';
    if ($hook_suffix !== $operations_hook) {
        return;
    }

    if (!current_user_can('manage_options')) {
        return;
    }

    $mount_id = 'sqmu-admin-ops';
    $payload = array(
        'global' => sqmu_app_get_runtime_global_config('admin'),
        'mounts' => array(
            $mount_id => sqmu_app_build_mount_config('admin_ops', '', '', 'admin')
        )
    );

    sqmu_app_enqueue_runtime_payload($payload);
}
add_action('admin_enqueue_scripts', 'sqmu_app_enqueue_admin_assets');

function sqmu_app_register_mount($atts) {
    if (!isset($GLOBALS['sqmu_app_mounts'])) {
        $GLOBALS['sqmu_app_mounts'] = array();
    }

    $view = isset($atts['view']) ? sanitize_key($atts['view']) : 'buy';
    if (!in_array($view, sqmu_app_allowed_views(), true)) {
        $view = 'buy';
    }

    $property_code = sanitize_text_field($atts['property_code'] ?? '');
    $escrow_address = sanitize_text_field($atts['escrow_address'] ?? '');
    $mount_config = sqmu_app_build_mount_config($view, $property_code, $escrow_address, 'public');

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
            'property_code' => '',
            'escrow_address' => ''
        ),
        $atts,
        'sqmu_app'
    );

    return sqmu_app_register_mount($atts);
}
add_shortcode('sqmu_app', 'sqmu_app_shortcode');
