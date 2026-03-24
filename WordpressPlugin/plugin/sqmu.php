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

function sqmu_app_property_bound_views() {
    return array('buy', 'portfolio', 'rent', 'rent_distribution', 'escrow');
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

function sqmu_app_add_settings_notice($message, $code = 'settings_error', $type = 'error') {
    add_settings_error(SQMU_APP_OPTION_KEY, $code, $message, $type);
}

function sqmu_app_value_is_blank($value) {
    if (is_array($value)) {
        foreach ($value as $nested_value) {
            if (!sqmu_app_value_is_blank($nested_value)) {
                return false;
            }
        }

        return true;
    }

    return trim((string) $value) === '';
}

function sqmu_app_sanitize_chain_rows($input, $fallback, $legacy_json = '') {
    if (!is_array($input)) {
        $decoded = sqmu_app_parse_json_textarea($legacy_json, null);
        if (is_array($decoded)) {
            $input = $decoded;
        } else {
            return $fallback;
        }
    }

    $chains = array();

    foreach ($input as $index => $row) {
        if (!is_array($row)) {
            continue;
        }

        $native_currency = isset($row['nativeCurrency']) && is_array($row['nativeCurrency'])
            ? $row['nativeCurrency']
            : array();

        if (
            sqmu_app_value_is_blank($row['id'] ?? '') &&
            sqmu_app_value_is_blank($row['name'] ?? '') &&
            sqmu_app_value_is_blank($row['rpcUrl'] ?? '') &&
            sqmu_app_value_is_blank($row['blockExplorerUrl'] ?? '') &&
            sqmu_app_value_is_blank($native_currency)
        ) {
            continue;
        }

        $display_index = is_numeric($index) ? (int) $index + 1 : 1;
        $id = $row['id'] ?? '';

        if ($id === '' || !is_numeric($id)) {
            sqmu_app_add_settings_notice(
                sprintf('Accepted chain row %d was skipped because Chain ID must be numeric.', $display_index),
                'invalid_chain_' . $display_index
            );
            continue;
        }

        $chains[] = array(
            'id' => (int) $id,
            'name' => sanitize_text_field($row['name'] ?? ''),
            'rpcUrl' => esc_url_raw($row['rpcUrl'] ?? ''),
            'blockExplorerUrl' => esc_url_raw($row['blockExplorerUrl'] ?? ''),
            'nativeCurrency' => array(
                'name' => sanitize_text_field($native_currency['name'] ?? ''),
                'symbol' => sanitize_text_field($native_currency['symbol'] ?? ''),
                'decimals' => isset($native_currency['decimals']) && $native_currency['decimals'] !== '' && is_numeric($native_currency['decimals'])
                    ? (int) $native_currency['decimals']
                    : 18
            )
        );
    }

    if (!empty($chains)) {
        return array_values($chains);
    }

    sqmu_app_add_settings_notice(
        'At least one accepted chain is required. The previous accepted chain settings were kept.',
        'missing_chains'
    );

    return $fallback;
}

function sqmu_app_sanitize_payment_token_rows($input, $fallback, $legacy_json = '') {
    if (!is_array($input)) {
        $decoded = sqmu_app_parse_json_textarea($legacy_json, null);
        if (is_array($decoded)) {
            $input = $decoded;
        } else {
            return $fallback;
        }
    }

    $tokens = array();

    foreach ($input as $index => $row) {
        if (!is_array($row)) {
            continue;
        }

        if (
            sqmu_app_value_is_blank($row['address'] ?? '') &&
            sqmu_app_value_is_blank($row['symbol'] ?? '') &&
            sqmu_app_value_is_blank($row['decimals'] ?? '')
        ) {
            continue;
        }

        $display_index = is_numeric($index) ? (int) $index + 1 : 1;
        $address = sanitize_text_field($row['address'] ?? '');
        $decimals = $row['decimals'] ?? '';

        if ($address === '') {
            sqmu_app_add_settings_notice(
                sprintf('Payment token row %d was skipped because the token address is required.', $display_index),
                'invalid_payment_token_address_' . $display_index
            );
            continue;
        }

        if ($decimals === '' || !is_numeric($decimals)) {
            sqmu_app_add_settings_notice(
                sprintf('Payment token row %d was skipped because decimals must be numeric.', $display_index),
                'invalid_payment_token_decimals_' . $display_index
            );
            continue;
        }

        $tokens[] = array(
            'address' => $address,
            'symbol' => sanitize_text_field($row['symbol'] ?? ''),
            'decimals' => (int) $decimals
        );
    }

    if (!empty($tokens)) {
        return array_values($tokens);
    }

    sqmu_app_add_settings_notice(
        'At least one accepted payment token is required. The previous payment token settings were kept.',
        'missing_payment_tokens'
    );

    return $fallback;
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
    $current = sqmu_app_get_settings();

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
        'chains' => sqmu_app_sanitize_chain_rows(
            $input['chains'] ?? null,
            $current['chains'] ?? $defaults['chains'],
            $input['chains_json'] ?? ''
        ),
        'contracts' => sqmu_app_sanitize_contracts($contracts_input, $defaults['contracts']),
        'paymentTokens' => sqmu_app_sanitize_payment_token_rows(
            $input['paymentTokens'] ?? null,
            $current['paymentTokens'] ?? $defaults['paymentTokens'],
            $input['payment_tokens_json'] ?? ''
        ),
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

function sqmu_app_get_chain_row_markup($index, $chain = array()) {
    $native_currency = isset($chain['nativeCurrency']) && is_array($chain['nativeCurrency'])
        ? $chain['nativeCurrency']
        : array();
    $option_name = esc_attr(SQMU_APP_OPTION_KEY);

    ob_start();
    ?>
    <tr data-sqmu-repeatable-item>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][id]" type="number" class="small-text" value="<?php echo esc_attr($chain['id'] ?? ''); ?>" data-sqmu-row-field="id" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][name]" type="text" class="regular-text" value="<?php echo esc_attr($chain['name'] ?? ''); ?>" data-sqmu-row-field="name" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][rpcUrl]" type="url" class="large-text" value="<?php echo esc_attr($chain['rpcUrl'] ?? ''); ?>" data-sqmu-row-field="rpcUrl" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][blockExplorerUrl]" type="url" class="large-text" value="<?php echo esc_attr($chain['blockExplorerUrl'] ?? ''); ?>" data-sqmu-row-field="blockExplorerUrl" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][nativeCurrency][name]" type="text" class="regular-text" value="<?php echo esc_attr($native_currency['name'] ?? ''); ?>" data-sqmu-row-field="nativeName" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][nativeCurrency][symbol]" type="text" class="small-text" value="<?php echo esc_attr($native_currency['symbol'] ?? ''); ?>" data-sqmu-row-field="nativeSymbol" /></td>
        <td><input name="<?php echo $option_name; ?>[chains][<?php echo esc_attr($index); ?>][nativeCurrency][decimals]" type="number" class="small-text" value="<?php echo esc_attr($native_currency['decimals'] ?? 18); ?>" data-sqmu-row-field="nativeDecimals" /></td>
        <td><button type="button" class="button-link-delete" data-sqmu-repeatable-remove>Delete</button></td>
    </tr>
    <?php

    return (string) ob_get_clean();
}

function sqmu_app_get_payment_token_row_markup($index, $token = array()) {
    $option_name = esc_attr(SQMU_APP_OPTION_KEY);

    ob_start();
    ?>
    <tr data-sqmu-repeatable-item>
        <td><input name="<?php echo $option_name; ?>[paymentTokens][<?php echo esc_attr($index); ?>][address]" type="text" class="large-text code" value="<?php echo esc_attr($token['address'] ?? ''); ?>" data-sqmu-row-field="address" /></td>
        <td><input name="<?php echo $option_name; ?>[paymentTokens][<?php echo esc_attr($index); ?>][symbol]" type="text" class="small-text" value="<?php echo esc_attr($token['symbol'] ?? ''); ?>" data-sqmu-row-field="symbol" /></td>
        <td><input name="<?php echo $option_name; ?>[paymentTokens][<?php echo esc_attr($index); ?>][decimals]" type="number" class="small-text" value="<?php echo esc_attr($token['decimals'] ?? 18); ?>" data-sqmu-row-field="decimals" /></td>
        <td><button type="button" class="button-link-delete" data-sqmu-repeatable-remove>Delete</button></td>
    </tr>
    <?php

    return (string) ob_get_clean();
}

function sqmu_app_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $settings = sqmu_app_get_settings();
    $chains = !empty($settings['chains']) && is_array($settings['chains'])
        ? array_values($settings['chains'])
        : array();
    $payment_tokens = !empty($settings['paymentTokens']) && is_array($settings['paymentTokens'])
        ? array_values($settings['paymentTokens'])
        : array();
    ?>
    <div class="wrap">
        <h1>SQMU App Settings</h1>
        <?php settings_errors(SQMU_APP_OPTION_KEY); ?>
        <p>Configure accepted chains, contract addresses, payment tokens, and per-view defaults for the shortcode-driven wallet application.</p>
        <p><strong>Property meta keys:</strong>
            <code><?php echo esc_html(SQMU_PROPERTY_CODE_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ID_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_ID_META_KEY); ?></code>,
            <code><?php echo esc_html(SQMU_PROPERTY_REF_META_KEY); ?></code>
        </p>
        <style>
            .sqmu-settings-table-wrap {
                margin: 12px 0 24px;
                overflow-x: auto;
            }

            .sqmu-add-grid {
                display: grid;
                gap: 12px;
                margin: 12px 0;
                justify-content: start;
            }

            .sqmu-add-grid-chains {
                grid-template-columns: minmax(0, 420px);
            }

            .sqmu-add-grid-tokens {
                grid-template-columns: minmax(0, 420px);
            }

            .sqmu-add-grid p {
                margin: 0;
            }

            .sqmu-add-grid label {
                display: block;
                text-align: left;
            }

            .sqmu-add-grid .large-text,
            .sqmu-add-grid .regular-text,
            .sqmu-add-grid .small-text {
                width: 100%;
                max-width: 420px;
            }

            .sqmu-settings-table {
                width: 100%;
                border-collapse: collapse;
                background: #fff;
            }

            .sqmu-settings-table th,
            .sqmu-settings-table td {
                padding: 10px 8px;
                vertical-align: top;
                border-bottom: 1px solid #dcdcde;
            }

            .sqmu-settings-table th {
                text-align: left;
            }

            .sqmu-settings-table .large-text,
            .sqmu-settings-table .regular-text,
            .sqmu-settings-table .small-text {
                width: 100%;
            }

            .sqmu-empty-row td {
                color: #646970;
                font-style: italic;
                text-align: center;
            }

            .sqmu-add-actions {
                margin: 0 0 16px;
                text-align: left;
            }
        </style>
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
            <p>Add a chain using the fields below, then review or edit the saved chains in the table.</p>
            <div data-sqmu-repeatable data-next-index="<?php echo esc_attr(count($chains)); ?>">
                <div class="sqmu-add-grid sqmu-add-grid-chains">
                    <p>
                        <label>
                            Chain ID<br />
                            <input type="number" class="small-text" data-sqmu-add-field="id" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Chain Name<br />
                            <input type="text" class="regular-text" data-sqmu-add-field="name" />
                        </label>
                    </p>
                    <p>
                        <label>
                            RPC URL<br />
                            <input type="url" class="large-text" data-sqmu-add-field="rpcUrl" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Block Explorer URL<br />
                            <input type="url" class="large-text" data-sqmu-add-field="blockExplorerUrl" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Native Currency Name<br />
                            <input type="text" class="regular-text" data-sqmu-add-field="nativeName" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Native Currency Symbol<br />
                            <input type="text" class="small-text" data-sqmu-add-field="nativeSymbol" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Native Currency Decimals<br />
                            <input type="number" class="small-text" data-sqmu-add-field="nativeDecimals" value="18" />
                        </label>
                    </p>
                </div>
                <p class="sqmu-add-actions"><button type="button" class="button" data-sqmu-repeatable-add>Add chain</button></p>
                <div class="sqmu-settings-table-wrap">
                    <table class="widefat striped sqmu-settings-table">
                        <thead>
                            <tr>
                                <th>Chain ID</th>
                                <th>Name</th>
                                <th>RPC URL</th>
                                <th>Block Explorer URL</th>
                                <th>Native Name</th>
                                <th>Native Symbol</th>
                                <th>Native Decimals</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody data-sqmu-repeatable-list>
                            <?php foreach ($chains as $index => $chain) : ?>
                                <?php echo sqmu_app_get_chain_row_markup($index, $chain); ?>
                            <?php endforeach; ?>
                            <tr class="sqmu-empty-row" data-sqmu-empty-row hidden>
                                <td colspan="8">No chains added yet.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <template><?php echo sqmu_app_get_chain_row_markup('__INDEX__', array()); ?></template>
            </div>

            <h2>Payment tokens</h2>
            <p>Add a payment token using the fields below, then review or edit the saved tokens in the table.</p>
            <div data-sqmu-repeatable data-next-index="<?php echo esc_attr(count($payment_tokens)); ?>">
                <div class="sqmu-add-grid sqmu-add-grid-tokens">
                    <p>
                        <label>
                            Token Address<br />
                            <input type="text" class="large-text code" data-sqmu-add-field="address" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Symbol<br />
                            <input type="text" class="small-text" data-sqmu-add-field="symbol" />
                        </label>
                    </p>
                    <p>
                        <label>
                            Decimals<br />
                            <input type="number" class="small-text" data-sqmu-add-field="decimals" value="18" />
                        </label>
                    </p>
                </div>
                <p class="sqmu-add-actions"><button type="button" class="button" data-sqmu-repeatable-add>Add payment token</button></p>
                <div class="sqmu-settings-table-wrap">
                    <table class="widefat striped sqmu-settings-table">
                        <thead>
                            <tr>
                                <th>Address</th>
                                <th>Symbol</th>
                                <th>Decimals</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody data-sqmu-repeatable-list>
                            <?php foreach ($payment_tokens as $index => $token) : ?>
                                <?php echo sqmu_app_get_payment_token_row_markup($index, $token); ?>
                            <?php endforeach; ?>
                            <tr class="sqmu-empty-row" data-sqmu-empty-row hidden>
                                <td colspan="4">No payment tokens added yet.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <template><?php echo sqmu_app_get_payment_token_row_markup('__INDEX__', array()); ?></template>
            </div>

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
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                document.querySelectorAll('[data-sqmu-repeatable]').forEach(function (group) {
                    var list = group.querySelector('[data-sqmu-repeatable-list]');
                    var template = group.querySelector('template');
                    var emptyRow = group.querySelector('[data-sqmu-empty-row]');
                    var addFields = group.querySelectorAll('[data-sqmu-add-field]');

                    if (!list || !template) {
                        return;
                    }

                    var syncEmptyState = function () {
                        if (!emptyRow) {
                            return;
                        }

                        var hasRows = list.querySelector('[data-sqmu-repeatable-item]') !== null;
                        emptyRow.hidden = hasRows;
                    };

                    var addRow = function () {
                        var nextIndex = Number(group.getAttribute('data-next-index') || '0');
                        group.setAttribute('data-next-index', String(nextIndex + 1));
                        list.insertAdjacentHTML('beforeend', template.innerHTML.replace(/__INDEX__/g, String(nextIndex)));

                        var rows = list.querySelectorAll('[data-sqmu-repeatable-item]');
                        var newRow = rows.length ? rows[rows.length - 1] : null;
                        if (newRow) {
                            addFields.forEach(function (field) {
                                var key = field.getAttribute('data-sqmu-add-field');
                                var target = newRow.querySelector('[data-sqmu-row-field="' + key + '"]');
                                if (target) {
                                    target.value = field.value;
                                }

                                if (field.type === 'number' && field.getAttribute('data-sqmu-add-field') === 'nativeDecimals') {
                                    field.value = '18';
                                } else if (field.type === 'number' && field.getAttribute('data-sqmu-add-field') === 'decimals') {
                                    field.value = '18';
                                } else {
                                    field.value = '';
                                }
                            });
                        }

                        syncEmptyState();
                    };

                    group.addEventListener('click', function (event) {
                        var addButton = event.target.closest('[data-sqmu-repeatable-add]');
                        if (addButton) {
                            event.preventDefault();
                            addRow();
                            return;
                        }

                        var removeButton = event.target.closest('[data-sqmu-repeatable-remove]');
                        if (!removeButton) {
                            return;
                        }

                        event.preventDefault();
                        var row = removeButton.closest('[data-sqmu-repeatable-item]');
                        if (!row) {
                            return;
                        }

                        row.remove();
                        syncEmptyState();
                    });

                    syncEmptyState();
                });
            });
        </script>
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

function sqmu_app_post_has_property_context($post) {
    if (!($post instanceof WP_Post)) {
        return false;
    }

    $meta_keys = array(
        SQMU_PROPERTY_CODE_META_KEY,
        SQMU_PROPERTY_TOKEN_ID_META_KEY,
        SQMU_PROPERTY_TOKEN_ADDRESS_META_KEY,
        SQMU_PROPERTY_ID_META_KEY,
        SQMU_PROPERTY_REF_META_KEY
    );

    foreach ($meta_keys as $meta_key) {
        $value = get_post_meta($post->ID, $meta_key, true);
        if (!sqmu_app_value_is_blank($value)) {
            return true;
        }
    }

    return false;
}

function sqmu_app_get_current_property_context_post() {
    $queried = get_queried_object();
    if ($queried instanceof WP_Post) {
        return $queried;
    }

    global $post;
    if ($post instanceof WP_Post) {
        return $post;
    }

    return null;
}

function sqmu_app_discover_property_code_for_view($view, $property_code = '') {
    $property_code = sanitize_text_field($property_code);
    if ($property_code !== '') {
        return array(
            'propertyCode' => $property_code,
            'source' => 'shortcode',
            'pageContextDetected' => false
        );
    }

    if (!in_array($view, sqmu_app_property_bound_views(), true)) {
        return array(
            'propertyCode' => '',
            'source' => 'none',
            'pageContextDetected' => false
        );
    }

    $post = sqmu_app_get_current_property_context_post();
    if (!($post instanceof WP_Post)) {
        return array(
            'propertyCode' => '',
            'source' => 'none',
            'pageContextDetected' => false
        );
    }

    $page_context_detected = sqmu_app_post_has_property_context($post);
    $record = sqmu_app_build_property_record($post);

    return array(
        'propertyCode' => $record['propertyCode'],
        'source' => $record['propertyCode'] !== '' ? 'post_meta' : 'none',
        'pageContextDetected' => $page_context_detected
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
        'properties' => $catalog['properties'],
        'duplicatePropertyCodes' => $catalog['duplicateCodes']
    );
}

function sqmu_app_build_mount_config($view, $property_code, $escrow_address = '', $context = 'public') {
    $settings = sqmu_app_get_settings();
    $view_defaults = isset($settings['viewDefaults'][$view]) && is_array($settings['viewDefaults'][$view])
        ? $settings['viewDefaults'][$view]
        : $settings['viewDefaults']['buy'];

    $catalog = sqmu_app_get_property_catalog();
    $property_bound = in_array($view, sqmu_app_property_bound_views(), true);
    $property_discovery = sqmu_app_discover_property_code_for_view($view, $property_code);
    $resolved_property_code = $property_discovery['propertyCode'];
    $property_result = sqmu_app_find_property_by_code($resolved_property_code);
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
        'duplicatePropertyCodes' => $catalog['duplicateCodes'],
        'features' => $view_defaults['features'],
        'propertyCode' => $resolved_property_code !== '' ? $resolved_property_code : null,
        'propertyLocked' => $property_bound && $selected_property !== null && $resolved_property_code !== '',
        'propertyDiscovery' => array(
            'propertyBound' => $property_bound,
            'source' => $property_discovery['source'],
            'pageContextDetected' => (bool) $property_discovery['pageContextDetected'],
            'explicitOverride' => $property_code !== ''
        ),
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
