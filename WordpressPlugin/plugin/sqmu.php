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
const SQMU_CONTRACT_BUNDLE_PIN_OPTION_KEY = 'sqmu_contract_bundle_pin';
const SQMU_CONTRACT_DEPLOYMENTS_OPTION_KEY = 'sqmu_contract_deployments';
const SQMU_CONTRACT_ACTIVE_DEPLOYMENTS_OPTION_KEY = 'sqmu_contract_active_deployments';
const SQMU_IMPORTED_SCENARIO_PROPERTIES_OPTION_KEY = 'sqmu_imported_scenario_properties';
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

function sqmu_app_default_consulting_payment_settings() {
    return array(
        'recipientWallet' => '',
        'fixedAmount' => '',
        'receiptWebhookUrl' => '',
        'calendlyUrl' => '',
        'allowedChainIds' => array(),
        'tokens' => array()
    );
}

function sqmu_app_default_contract_bundle_pin() {
    return array(
        'schemaVersion' => 1,
        'enabled' => false,
        'release' => array(
            'version' => '',
            'tag' => '',
            'asset' => '',
            'sha256' => ''
        )
    );
}

function sqmu_app_default_contract_deployments() {
    return array();
}

function sqmu_app_default_active_contract_deployments() {
    return array();
}

function sqmu_app_default_imported_scenario_properties() {
    return array();
}

function sqmu_app_allowed_deployment_statuses() {
    return array('draft', 'active', 'superseded', 'failed');
}

function sqmu_app_default_view_defaults() {
    return array(
        'buy' => array(
            'defaultChainId' => 0,
            'features' => array(
                'buy' => true,
                'portfolio' => true,
                'sell' => false
            )
        ),
        'portfolio' => array(
            'defaultChainId' => 0,
            'features' => array(
                'buy' => true,
                'portfolio' => true,
                'sell' => true
            )
        ),
        'crowdfund' => array(
            'defaultChainId' => 0,
            'features' => array(
                'buy' => true,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'rent' => array(
            'defaultChainId' => 0,
            'features' => array(
                'buy' => false,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'rent_distribution' => array(
            'defaultChainId' => 0,
            'features' => array(
                'buy' => false,
                'portfolio' => false,
                'sell' => false
            )
        ),
        'escrow' => array(
            'defaultChainId' => 0,
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
        'chains' => array(),
        'contracts' => array(
            'distributor' => '',
            'trade' => '',
            'sqmu' => '',
            'crowdfund' => '',
            'rent' => '',
            'rentDistribution' => '',
            'escrowFactory' => ''
        ),
        'paymentTokens' => array(),
        'consultingPayment' => sqmu_app_default_consulting_payment_settings(),
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

function sqmu_app_read_json_file($file_path) {
    if (!is_string($file_path) || $file_path === '' || !file_exists($file_path) || !is_readable($file_path)) {
        return null;
    }

    $decoded = json_decode((string) file_get_contents($file_path), true);
    return is_array($decoded) ? $decoded : null;
}

function sqmu_app_get_contract_bundle_pin_file_paths() {
    return array(
        plugin_dir_path(__FILE__) . 'contract-bundle.json',
        dirname(plugin_dir_path(__FILE__)) . '/contract-bundle.json'
    );
}

function sqmu_app_get_contract_manifest_file_paths() {
    return array(
        plugin_dir_path(__FILE__) . 'contracts/current/manifest.json',
        dirname(plugin_dir_path(__FILE__)) . '/contracts/current/manifest.json'
    );
}

function sqmu_app_get_contract_bundle_root_paths() {
    return array(
        plugin_dir_path(__FILE__) . 'contracts/current',
        dirname(plugin_dir_path(__FILE__)) . '/contracts/current'
    );
}

function sqmu_app_get_packaged_contract_bundle_pin() {
    $defaults = sqmu_app_default_contract_bundle_pin();

    foreach (sqmu_app_get_contract_bundle_pin_file_paths() as $file_path) {
        $decoded = sqmu_app_read_json_file($file_path);
        if (is_array($decoded)) {
            return array_replace_recursive($defaults, $decoded);
        }
    }

    return $defaults;
}

function sqmu_app_get_packaged_contract_manifest() {
    foreach (sqmu_app_get_contract_manifest_file_paths() as $file_path) {
        $decoded = sqmu_app_read_json_file($file_path);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    return null;
}

function sqmu_app_get_packaged_contract_manifest_sha256() {
    foreach (sqmu_app_get_contract_manifest_file_paths() as $file_path) {
        if (is_readable($file_path)) {
            return hash_file('sha256', $file_path);
        }
    }

    return '';
}

function sqmu_app_get_packaged_contract_bundle() {
    static $bundle = null;

    if ($bundle !== null) {
        return $bundle;
    }

    foreach (sqmu_app_get_contract_bundle_root_paths() as $bundle_root) {
        $manifest_path = trailingslashit($bundle_root) . 'manifest.json';
        $manifest = sqmu_app_read_json_file($manifest_path);
        if (!is_array($manifest)) {
            continue;
        }

        $contracts = array();
        foreach (($manifest['contracts'] ?? array()) as $contract_meta) {
            if (!is_array($contract_meta)) {
                continue;
            }

            $name = sanitize_text_field($contract_meta['name'] ?? '');
            $contract_file = sanitize_text_field($contract_meta['files']['contract'] ?? '');
            if ($name === '' || $contract_file === '') {
                continue;
            }

            $contract_json = sqmu_app_read_json_file(trailingslashit($bundle_root) . ltrim($contract_file, '/'));
            if (is_array($contract_json)) {
                $contracts[$name] = $contract_json;
            }
        }

        $support = array();
        $proxy_file = sanitize_text_field($manifest['support']['erc1967Proxy']['file'] ?? '');
        if ($proxy_file !== '') {
            $proxy_json = sqmu_app_read_json_file(trailingslashit($bundle_root) . ltrim($proxy_file, '/'));
            if (is_array($proxy_json)) {
                $support['ERC1967Proxy'] = $proxy_json;
            }
        }

        $bundle = array(
            'rootPath' => $bundle_root,
            'manifest' => $manifest,
            'manifestSha256' => hash_file('sha256', $manifest_path),
            'contracts' => $contracts,
            'support' => $support
        );

        return $bundle;
    }

    $bundle = null;
    return null;
}

function sqmu_app_get_stored_contract_bundle_pin() {
    $defaults = sqmu_app_default_contract_bundle_pin();
    $stored = get_option(SQMU_CONTRACT_BUNDLE_PIN_OPTION_KEY, $defaults);

    if (!is_array($stored)) {
        $stored = array();
    }

    return array_replace_recursive($defaults, $stored);
}

function sqmu_app_normalize_optional_address($value) {
    $value = sanitize_text_field($value);
    return sqmu_app_is_valid_address($value) ? $value : '';
}

function sqmu_app_normalize_tx_hash($value) {
    $value = sanitize_text_field($value);
    return sqmu_app_is_valid_bytes32($value) ? $value : '';
}

function sqmu_app_normalize_contract_deployment_contracts($contracts) {
    if (!is_array($contracts)) {
        return array();
    }

    $normalized = array();

    foreach ($contracts as $key => $contract) {
        if (!is_array($contract)) {
            continue;
        }

        $name = sanitize_text_field(is_string($key) ? $key : ($contract['name'] ?? ''));
        if ($name === '') {
            continue;
        }

        $normalized[$name] = array(
            'name' => $name,
            'address' => sqmu_app_normalize_optional_address($contract['address'] ?? ''),
            'proxyAddress' => sqmu_app_normalize_optional_address($contract['proxyAddress'] ?? ''),
            'implementationAddress' => sqmu_app_normalize_optional_address($contract['implementationAddress'] ?? ''),
            'txHash' => sqmu_app_normalize_tx_hash($contract['txHash'] ?? ''),
            'deploymentKind' => sanitize_key($contract['deploymentKind'] ?? '')
        );
    }

    ksort($normalized, SORT_NATURAL | SORT_FLAG_CASE);
    return $normalized;
}

function sqmu_app_normalize_contract_deployment_record($record, $fallback_id = '') {
    $record = is_array($record) ? $record : array();
    $status = sanitize_key($record['status'] ?? '');
    if (!in_array($status, sqmu_app_allowed_deployment_statuses(), true)) {
        $status = 'draft';
    }

    $deployment_id = sanitize_key($record['deploymentId'] ?? $fallback_id);
    if ($deployment_id === '') {
        $deployment_id = sanitize_key('sqmu-deployment-' . wp_generate_uuid4());
    }

    $manifest_sha256 = sanitize_text_field($record['manifestSha256'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $manifest_sha256)) {
        $manifest_sha256 = '';
    }

    $tx_hashes = array();
    if (isset($record['txHashes']) && is_array($record['txHashes'])) {
        foreach ($record['txHashes'] as $name => $hash) {
            $normalized_hash = sqmu_app_normalize_tx_hash($hash);
            if ($normalized_hash === '') {
                continue;
            }

            $key = sanitize_text_field(is_string($name) ? $name : 'tx_' . count($tx_hashes));
            $tx_hashes[$key] = $normalized_hash;
        }
    }

    return array(
        'deploymentId' => $deployment_id,
        'chainId' => isset($record['chainId']) && is_numeric($record['chainId']) ? (int) $record['chainId'] : 0,
        'releaseVersion' => sanitize_text_field($record['releaseVersion'] ?? ''),
        'manifestVersion' => sanitize_text_field($record['manifestVersion'] ?? ''),
        'manifestSha256' => strtolower($manifest_sha256),
        'deployedAt' => sanitize_text_field($record['deployedAt'] ?? ''),
        'deployerWallet' => sqmu_app_normalize_optional_address($record['deployerWallet'] ?? ''),
        'status' => $status,
        'contracts' => sqmu_app_normalize_contract_deployment_contracts($record['contracts'] ?? array()),
        'txHashes' => $tx_hashes
    );
}

function sqmu_app_get_contract_deployments() {
    $stored = get_option(SQMU_CONTRACT_DEPLOYMENTS_OPTION_KEY, sqmu_app_default_contract_deployments());
    if (!is_array($stored)) {
        return array();
    }

    $deployments = array();
    foreach ($stored as $deployment_id => $record) {
        $normalized = sqmu_app_normalize_contract_deployment_record($record, is_string($deployment_id) ? $deployment_id : '');
        $deployments[$normalized['deploymentId']] = $normalized;
    }

    uasort(
        $deployments,
        static function ($left, $right) {
            return strcmp($right['deployedAt'] ?? '', $left['deployedAt'] ?? '');
        }
    );

    return $deployments;
}

function sqmu_app_get_active_contract_deployments() {
    $stored = get_option(SQMU_CONTRACT_ACTIVE_DEPLOYMENTS_OPTION_KEY, sqmu_app_default_active_contract_deployments());
    $deployments = sqmu_app_get_contract_deployments();
    $active = array();

    if (!is_array($stored)) {
        return $active;
    }

    foreach ($stored as $chain_id => $deployment_id) {
        if (!is_numeric($chain_id)) {
            continue;
        }

        $normalized_chain_id = (int) $chain_id;
        $normalized_deployment_id = sanitize_key($deployment_id);
        if ($normalized_deployment_id === '' || !isset($deployments[$normalized_deployment_id])) {
            continue;
        }

        $active[$normalized_chain_id] = $normalized_deployment_id;
    }

    ksort($active, SORT_NUMERIC);
    return $active;
}

function sqmu_app_persist_contract_deployments($deployments) {
    update_option(SQMU_CONTRACT_DEPLOYMENTS_OPTION_KEY, $deployments, false);
}

function sqmu_app_persist_active_contract_deployments($active_deployments) {
    update_option(SQMU_CONTRACT_ACTIVE_DEPLOYMENTS_OPTION_KEY, $active_deployments, false);
}

function sqmu_app_normalize_imported_scenario_property($record) {
    $record = is_array($record) ? $record : array();
    $property_code = sanitize_text_field($record['propertyCode'] ?? '');
    if ($property_code === '') {
        return null;
    }

    $token_id = isset($record['tokenId']) && is_numeric($record['tokenId']) ? (int) $record['tokenId'] : null;
    $property_id = isset($record['propertyId']) && is_numeric($record['propertyId'])
        ? (int) $record['propertyId']
        : $token_id;
    $property_ref = sanitize_text_field($record['propertyRef'] ?? '');

    return array(
        'propertyCode' => $property_code,
        'tokenId' => $token_id,
        'tokenAddress' => sqmu_app_normalize_optional_address($record['tokenAddress'] ?? ''),
        'propertyId' => $property_id,
        'propertyRef' => sqmu_app_is_valid_bytes32($property_ref) ? $property_ref : null,
        'postId' => 0,
        'postTitle' => sanitize_text_field($record['postTitle'] ?? sprintf('Imported %s', $property_code))
    );
}

function sqmu_app_get_imported_scenario_properties() {
    $stored = get_option(SQMU_IMPORTED_SCENARIO_PROPERTIES_OPTION_KEY, sqmu_app_default_imported_scenario_properties());
    if (!is_array($stored)) {
        return array();
    }

    $properties = array();
    foreach ($stored as $property_code => $record) {
        $normalized = sqmu_app_normalize_imported_scenario_property(
            is_array($record) ? $record : array('propertyCode' => is_string($property_code) ? $property_code : '')
        );
        if (!$normalized) {
            continue;
        }

        $properties[$normalized['propertyCode']] = $normalized;
    }

    ksort($properties, SORT_NATURAL | SORT_FLAG_CASE);
    return $properties;
}

function sqmu_app_persist_imported_scenario_properties($properties) {
    update_option(SQMU_IMPORTED_SCENARIO_PROPERTIES_OPTION_KEY, $properties, false);
}

function sqmu_app_upsert_imported_scenario_property($record) {
    $normalized = sqmu_app_normalize_imported_scenario_property($record);
    if (!$normalized) {
        return null;
    }

    $properties = sqmu_app_get_imported_scenario_properties();
    $properties[$normalized['propertyCode']] = $normalized;
    sqmu_app_persist_imported_scenario_properties($properties);

    return $normalized;
}

function sqmu_app_build_scenario_import_deployment_id($chain_id, $report) {
    $chain_id = (int) $chain_id;
    $contracts = isset($report['deployments']) && is_array($report['deployments']) ? $report['deployments'] : array();
    $seed = $contracts['EscrowFactory']['proxyAddress'] ?? $contracts['EscrowFactory']['address'] ?? '';
    $seed = sanitize_text_field($seed);
    $suffix = $seed !== '' ? strtolower(substr(preg_replace('/^0x/i', '', $seed), 0, 8)) : gmdate('YmdHis');

    return sanitize_key(sprintf('sqmu-import-%d-%s', $chain_id, $suffix));
}

function sqmu_app_upsert_chain_config($chains, $chain) {
    $chain = is_array($chain) ? $chain : array();
    $chain_id = isset($chain['id']) && is_numeric($chain['id']) ? (int) $chain['id'] : 0;
    if ($chain_id <= 0) {
        return is_array($chains) ? array_values($chains) : array();
    }

    $normalized_chain = array(
        'id' => $chain_id,
        'name' => sanitize_text_field($chain['name'] ?? sprintf('Chain %d', $chain_id)),
        'rpcUrl' => esc_url_raw($chain['rpcUrl'] ?? ''),
        'blockExplorerUrl' => esc_url_raw($chain['blockExplorerUrl'] ?? ''),
        'nativeCurrency' => array(
            'name' => sanitize_text_field($chain['nativeCurrency']['name'] ?? 'Ether'),
            'symbol' => sanitize_text_field($chain['nativeCurrency']['symbol'] ?? 'ETH'),
            'decimals' => isset($chain['nativeCurrency']['decimals']) && is_numeric($chain['nativeCurrency']['decimals'])
                ? (int) $chain['nativeCurrency']['decimals']
                : 18
        )
    );

    $updated = array();
    $replaced = false;
    foreach (is_array($chains) ? $chains : array() as $existing_chain) {
        if (!is_array($existing_chain) || !isset($existing_chain['id']) || !is_numeric($existing_chain['id'])) {
            continue;
        }

        if ((int) $existing_chain['id'] === $chain_id) {
            $updated[] = $normalized_chain;
            $replaced = true;
        } else {
            $updated[] = $existing_chain;
        }
    }

    if (!$replaced) {
        $updated[] = $normalized_chain;
    }

    usort(
        $updated,
        static function ($left, $right) {
            return ((int) ($left['id'] ?? 0)) <=> ((int) ($right['id'] ?? 0));
        }
    );

    return array_values($updated);
}

function sqmu_app_merge_payment_token_record($tokens, $token) {
    $token = is_array($token) ? $token : array();
    $address = sqmu_app_normalize_optional_address($token['address'] ?? '');
    if ($address === '') {
        return is_array($tokens) ? array_values($tokens) : array();
    }

    $normalized = array(
        'address' => $address,
        'symbol' => sanitize_text_field($token['symbol'] ?? ''),
        'decimals' => isset($token['decimals']) && is_numeric($token['decimals']) ? (int) $token['decimals'] : 18
    );

    $updated = array();
    $replaced = false;
    foreach (is_array($tokens) ? $tokens : array() as $existing_token) {
        if (!is_array($existing_token)) {
            continue;
        }

        $existing_address = sqmu_app_normalize_optional_address($existing_token['address'] ?? '');
        if ($existing_address !== '' && strtolower($existing_address) === strtolower($address)) {
            $updated[] = $normalized;
            $replaced = true;
        } else {
            $updated[] = $existing_token;
        }
    }

    if (!$replaced) {
        $updated[] = $normalized;
    }

    return array_values($updated);
}

function sqmu_app_apply_default_chain_id_to_empty_views($settings, $chain_id) {
    $chain_id = (int) $chain_id;
    if ($chain_id <= 0 || !is_array($settings)) {
        return $settings;
    }

    foreach (($settings['viewDefaults'] ?? array()) as $view => $defaults) {
        if (!is_array($defaults)) {
            continue;
        }

        if (empty($settings['viewDefaults'][$view]['defaultChainId'])) {
            $settings['viewDefaults'][$view]['defaultChainId'] = $chain_id;
        }
    }

    return $settings;
}

function sqmu_app_upsert_contract_deployment($record) {
    $deployments = sqmu_app_get_contract_deployments();
    $normalized = sqmu_app_normalize_contract_deployment_record($record);
    $deployment_id = $normalized['deploymentId'];

    $deployments[$deployment_id] = $normalized;

    $active_deployments = sqmu_app_get_active_contract_deployments();
    if ($normalized['status'] === 'active' && $normalized['chainId'] > 0) {
        $existing_active_id = $active_deployments[$normalized['chainId']] ?? '';
        if ($existing_active_id !== '' && $existing_active_id !== $deployment_id && isset($deployments[$existing_active_id])) {
            $deployments[$existing_active_id]['status'] = 'superseded';
        }

        $active_deployments[$normalized['chainId']] = $deployment_id;
    } elseif (($active_deployments[$normalized['chainId']] ?? '') === $deployment_id) {
        unset($active_deployments[$normalized['chainId']]);
    }

    sqmu_app_persist_contract_deployments($deployments);
    sqmu_app_persist_active_contract_deployments($active_deployments);

    return $normalized;
}

function sqmu_app_contract_name_to_settings_key_map() {
    return array(
        'AtomicSQMUDistributor' => 'distributor',
        'SQMUTrade' => 'trade',
        'SQMU' => 'sqmu',
        'SQMUCrowdfund' => 'crowdfund',
        'SQMURent' => 'rent',
        'SQMURentDistribution' => 'rentDistribution',
        'EscrowFactory' => 'escrowFactory'
    );
}

function sqmu_app_get_deployment_contract_address($contract) {
    if (!is_array($contract)) {
        return '';
    }

    foreach (array('address', 'proxyAddress', 'implementationAddress') as $key) {
        $value = sqmu_app_normalize_optional_address($contract[$key] ?? '');
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function sqmu_app_sync_contract_settings_from_deployment($deployment) {
    $deployment = sqmu_app_normalize_contract_deployment_record($deployment);
    $settings = sqmu_app_get_settings();
    $map = sqmu_app_contract_name_to_settings_key_map();
    $synced = array();

    foreach ($map as $contract_name => $settings_key) {
        if (!isset($deployment['contracts'][$contract_name])) {
            continue;
        }

        $resolved_address = sqmu_app_get_deployment_contract_address($deployment['contracts'][$contract_name]);
        if ($resolved_address === '') {
            continue;
        }

        $settings['contracts'][$settings_key] = $resolved_address;
        $synced[$settings_key] = $resolved_address;
    }

    if ($deployment['chainId'] > 0) {
        foreach ($settings['viewDefaults'] as $view => $defaults) {
            if (!is_array($defaults)) {
                continue;
            }

            if (empty($settings['viewDefaults'][$view]['defaultChainId'])) {
                $settings['viewDefaults'][$view]['defaultChainId'] = $deployment['chainId'];
            }
        }
    }

    update_option(SQMU_APP_OPTION_KEY, $settings, false);

    return array(
        'contracts' => $synced,
        'settings' => $settings
    );
}

function sqmu_app_rest_can_manage_options() {
    return current_user_can('manage_options');
}

function sqmu_app_rest_get_deployments_state() {
    $deployments = array_values(sqmu_app_get_contract_deployments());

    return rest_ensure_response(
        array(
            'deployments' => $deployments,
            'activeDeployments' => sqmu_app_get_active_contract_deployments(),
            'storedPin' => sqmu_app_get_stored_contract_bundle_pin()
        )
    );
}

function sqmu_app_rest_upsert_deployment(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('sqmu_invalid_deployment_payload', 'Deployment payload must be a JSON object.', array('status' => 400));
    }

    $record = isset($params['record']) && is_array($params['record']) ? $params['record'] : $params;
    $sync_current_contracts = !empty($params['syncCurrentContracts']);
    $normalized = sqmu_app_upsert_contract_deployment($record);
    $synced = array(
        'contracts' => array()
    );

    if ($sync_current_contracts && $normalized['status'] === 'active') {
        $synced = sqmu_app_sync_contract_settings_from_deployment($normalized);
    }

    return rest_ensure_response(
        array(
            'deployment' => $normalized,
            'deployments' => array_values(sqmu_app_get_contract_deployments()),
            'activeDeployments' => sqmu_app_get_active_contract_deployments(),
            'syncedContracts' => $synced['contracts'],
            'settings' => $synced['settings'] ?? null
        )
    );
}

function sqmu_app_rest_import_scenario(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('sqmu_invalid_scenario_payload', 'Scenario import payload must be a JSON object.', array('status' => 400));
    }

    $report = isset($params['report']) && is_array($params['report']) ? $params['report'] : null;
    if (!$report) {
        return new WP_Error('sqmu_invalid_scenario_report', 'Scenario import requires a report object.', array('status' => 400));
    }

    $chain_id = isset($report['chainId']) && is_numeric($report['chainId']) ? (int) $report['chainId'] : 0;
    if ($chain_id <= 0) {
        return new WP_Error('sqmu_invalid_scenario_chain', 'Scenario report must include a numeric chainId.', array('status' => 400));
    }

    $settings = sqmu_app_get_settings();
    $settings_changed = false;
    $import_chain = !empty($params['importChain']);
    $import_payment_token = !empty($params['importPaymentToken']);
    $import_property = !empty($params['importProperty']);
    $activate_deployment = !empty($params['activateDeployment']);
    $sync_current_contracts = !empty($params['syncCurrentContracts']);
    $chain_input = isset($params['chain']) && is_array($params['chain']) ? $params['chain'] : array();

    $existing_chain = null;
    foreach ($settings['chains'] as $chain) {
        if (is_array($chain) && isset($chain['id']) && (int) $chain['id'] === $chain_id) {
            $existing_chain = $chain;
            break;
        }
    }

    $chain_config = array(
        'id' => $chain_id,
        'name' => sanitize_text_field($chain_input['name'] ?? ($existing_chain['name'] ?? sprintf('Chain %d', $chain_id))),
        'rpcUrl' => $chain_input['rpcUrl'] ?? ($existing_chain['rpcUrl'] ?? ($report['rpcUrl'] ?? '')),
        'blockExplorerUrl' => $chain_input['blockExplorerUrl'] ?? ($existing_chain['blockExplorerUrl'] ?? ''),
        'nativeCurrency' => array(
            'name' => sanitize_text_field($chain_input['nativeCurrency']['name'] ?? ($existing_chain['nativeCurrency']['name'] ?? 'Ether')),
            'symbol' => sanitize_text_field($chain_input['nativeCurrency']['symbol'] ?? ($existing_chain['nativeCurrency']['symbol'] ?? 'ETH')),
            'decimals' => isset($chain_input['nativeCurrency']['decimals']) && is_numeric($chain_input['nativeCurrency']['decimals'])
                ? (int) $chain_input['nativeCurrency']['decimals']
                : (isset($existing_chain['nativeCurrency']['decimals']) && is_numeric($existing_chain['nativeCurrency']['decimals']) ? (int) $existing_chain['nativeCurrency']['decimals'] : 18)
        )
    );

    if ($import_chain) {
        $settings['chains'] = sqmu_app_upsert_chain_config($settings['chains'], $chain_config);
        $settings = sqmu_app_apply_default_chain_id_to_empty_views($settings, $chain_id);
        $settings_changed = true;
    }

    $imported_token = null;
    if ($import_payment_token && isset($report['token']) && is_array($report['token'])) {
        $imported_token = array(
            'address' => $report['token']['address'] ?? '',
            'symbol' => $report['token']['symbol'] ?? '',
            'decimals' => $report['token']['decimals'] ?? 18
        );
        $settings['paymentTokens'] = sqmu_app_merge_payment_token_record($settings['paymentTokens'], $imported_token);
        $settings_changed = true;
        $imported_token = sqmu_app_merge_payment_token_record(array(), $imported_token);
        $imported_token = $imported_token ? $imported_token[0] : null;
    }

    if ($settings_changed) {
        update_option(SQMU_APP_OPTION_KEY, $settings, false);
    }

    $deployment_record = array(
        'deploymentId' => sanitize_key($params['deploymentId'] ?? sqmu_app_build_scenario_import_deployment_id($chain_id, $report)),
        'chainId' => $chain_id,
        'releaseVersion' => sanitize_text_field($report['bundle']['version'] ?? ''),
        'manifestVersion' => sanitize_text_field($report['bundle']['manifestVersion'] ?? ''),
        'manifestSha256' => sanitize_text_field($report['bundle']['manifestSha256'] ?? ''),
        'deployedAt' => sanitize_text_field($report['checkedAt'] ?? current_time('c')),
        'deployerWallet' => sqmu_app_normalize_optional_address($report['actors']['deployer'] ?? ''),
        'status' => $activate_deployment ? 'active' : 'draft',
        'contracts' => isset($report['deployments']) && is_array($report['deployments']) ? $report['deployments'] : array(),
        'txHashes' => isset($report['txHashes']) && is_array($report['txHashes']) ? $report['txHashes'] : array()
    );

    $normalized_deployment = sqmu_app_upsert_contract_deployment($deployment_record);

    $imported_property = null;
    if ($import_property && isset($report['property']) && is_array($report['property'])) {
        $sqmu_address = sqmu_app_get_deployment_contract_address($normalized_deployment['contracts']['SQMU'] ?? array());
        $imported_property = sqmu_app_upsert_imported_scenario_property(
            array(
                'propertyCode' => $report['property']['code'] ?? '',
                'tokenId' => $report['property']['tokenId'] ?? null,
                'tokenAddress' => $sqmu_address,
                'propertyId' => $report['property']['propertyId'] ?? ($report['property']['tokenId'] ?? null),
                'propertyRef' => $report['property']['ref'] ?? '',
                'postTitle' => sanitize_text_field($report['property']['name'] ?? sprintf('Imported %s', sanitize_text_field($report['property']['code'] ?? 'Scenario Property')))
            )
        );
    }

    $synced = array('contracts' => array());
    if ($sync_current_contracts && $normalized_deployment['status'] === 'active') {
        $synced = sqmu_app_sync_contract_settings_from_deployment($normalized_deployment);
    }

    $updated_settings = sqmu_app_get_settings();

    return rest_ensure_response(
        array(
            'deployment' => $normalized_deployment,
            'deployments' => array_values(sqmu_app_get_contract_deployments()),
            'activeDeployments' => sqmu_app_get_active_contract_deployments(),
            'syncedContracts' => $synced['contracts'],
            'settings' => $synced['settings'] ?? null,
            'chains' => $updated_settings['chains'],
            'paymentTokens' => $updated_settings['paymentTokens'],
            'importedChain' => $import_chain ? $chain_config : null,
            'importedToken' => $imported_token,
            'importedProperty' => $imported_property
        )
    );
}

function sqmu_app_register_rest_routes() {
    register_rest_route(
        'sqmu/v1',
        '/deployments',
        array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => 'sqmu_app_rest_get_deployments_state',
                'permission_callback' => 'sqmu_app_rest_can_manage_options'
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => 'sqmu_app_rest_upsert_deployment',
                'permission_callback' => 'sqmu_app_rest_can_manage_options'
            )
        )
    );

    register_rest_route(
        'sqmu/v1',
        '/deployments/import-scenario',
        array(
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => 'sqmu_app_rest_import_scenario',
                'permission_callback' => 'sqmu_app_rest_can_manage_options'
            )
        )
    );
}
add_action('rest_api_init', 'sqmu_app_register_rest_routes');

function sqmu_app_refresh_contract_bundle_pin_mirror() {
    $packaged_pin = sqmu_app_get_packaged_contract_bundle_pin();
    $stored_pin = get_option(SQMU_CONTRACT_BUNDLE_PIN_OPTION_KEY, null);

    if ($stored_pin !== $packaged_pin) {
        update_option(SQMU_CONTRACT_BUNDLE_PIN_OPTION_KEY, $packaged_pin, false);
    }
}

function sqmu_app_activate_plugin() {
    add_option(SQMU_CONTRACT_DEPLOYMENTS_OPTION_KEY, sqmu_app_default_contract_deployments(), '', false);
    add_option(SQMU_CONTRACT_ACTIVE_DEPLOYMENTS_OPTION_KEY, sqmu_app_default_active_contract_deployments(), '', false);
    add_option(SQMU_IMPORTED_SCENARIO_PROPERTIES_OPTION_KEY, sqmu_app_default_imported_scenario_properties(), '', false);
    sqmu_app_refresh_contract_bundle_pin_mirror();
}
register_activation_hook(__FILE__, 'sqmu_app_activate_plugin');

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

function sqmu_app_is_valid_address($value) {
    return is_string($value) && preg_match('/^0x[a-fA-F0-9]{40}$/', trim($value)) === 1;
}

function sqmu_app_sanitize_chain_rows($input, $fallback, $legacy_json = '') {
    if (!is_array($input)) {
        $decoded = sqmu_app_parse_json_textarea($legacy_json, null);
        if (is_array($decoded)) {
            $input = $decoded;
        } else {
            $input = array();
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

    return array_values($chains);
}

function sqmu_app_sanitize_payment_token_rows($input, $fallback, $legacy_json = '') {
    if (!is_array($input)) {
        $decoded = sqmu_app_parse_json_textarea($legacy_json, null);
        if (is_array($decoded)) {
            $input = $decoded;
        } else {
            $input = array();
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

    return array_values($tokens);
}

function sqmu_app_sanitize_chain_id_list($input, $available_chains) {
    $allowed_ids = array();
    foreach ($available_chains as $chain) {
        if (isset($chain['id']) && is_numeric($chain['id'])) {
            $allowed_ids[] = (int) $chain['id'];
        }
    }

    $selected_ids = array();
    foreach ((array) $input as $value) {
        if ($value === '' || !is_numeric($value)) {
            continue;
        }

        $chain_id = (int) $value;
        if (in_array($chain_id, $allowed_ids, true) && !in_array($chain_id, $selected_ids, true)) {
            $selected_ids[] = $chain_id;
        }
    }

    return $selected_ids;
}

function sqmu_app_sanitize_consulting_payment_tokens($input, $available_chain_ids, $fallback) {
    if (!is_array($input)) {
        return $fallback;
    }

    $tokens = array();

    foreach ($input as $index => $row) {
        if (!is_array($row)) {
            continue;
        }

        if (
            sqmu_app_value_is_blank($row['chainId'] ?? '') &&
            sqmu_app_value_is_blank($row['address'] ?? '') &&
            sqmu_app_value_is_blank($row['symbol'] ?? '') &&
            sqmu_app_value_is_blank($row['decimals'] ?? '')
        ) {
            continue;
        }

        $display_index = is_numeric($index) ? (int) $index + 1 : 1;
        $chain_id = $row['chainId'] ?? '';
        $address = sanitize_text_field($row['address'] ?? '');
        $decimals = $row['decimals'] ?? '';

        if ($chain_id === '' || !is_numeric($chain_id) || !in_array((int) $chain_id, $available_chain_ids, true)) {
            sqmu_app_add_settings_notice(
                sprintf('Consulting payment token row %d was skipped because it must reference one of the allowed consulting payment chains.', $display_index),
                'invalid_consulting_payment_token_chain_' . $display_index
            );
            continue;
        }

        if ($address === '') {
            sqmu_app_add_settings_notice(
                sprintf('Consulting payment token row %d was skipped because the token address is required.', $display_index),
                'invalid_consulting_payment_token_address_' . $display_index
            );
            continue;
        }

        if ($decimals === '' || !is_numeric($decimals)) {
            sqmu_app_add_settings_notice(
                sprintf('Consulting payment token row %d was skipped because decimals must be numeric.', $display_index),
                'invalid_consulting_payment_token_decimals_' . $display_index
            );
            continue;
        }

        $tokens[] = array(
            'chainId' => (int) $chain_id,
            'address' => $address,
            'symbol' => sanitize_text_field($row['symbol'] ?? ''),
            'decimals' => (int) $decimals
        );
    }

    return array_values($tokens);
}

function sqmu_app_sanitize_consulting_payment_settings($input, $defaults, $current, $available_chains) {
    $profile_input = is_array($input) ? $input : array();
    $available_chain_ids = array();
    foreach ($available_chains as $chain) {
        if (isset($chain['id']) && is_numeric($chain['id'])) {
            $available_chain_ids[] = (int) $chain['id'];
        }
    }

    $allowed_chain_ids = sqmu_app_sanitize_chain_id_list($profile_input['allowedChainIds'] ?? array(), $available_chains);
    $fixed_amount = sanitize_text_field($profile_input['fixedAmount'] ?? $current['fixedAmount'] ?? $defaults['fixedAmount']);
    if ($fixed_amount !== '' && preg_match('/^\d+(\.\d{1,18})?$/', $fixed_amount) !== 1) {
        sqmu_app_add_settings_notice(
            'Consulting payment amount was invalid. The previous consulting payment amount was kept.',
            'invalid_consulting_payment_amount'
        );
        $fixed_amount = $current['fixedAmount'] ?? $defaults['fixedAmount'];
    }

    $recipient_wallet = sanitize_text_field($profile_input['recipientWallet'] ?? $current['recipientWallet'] ?? $defaults['recipientWallet']);
    if ($recipient_wallet !== '' && !sqmu_app_is_valid_address($recipient_wallet)) {
        sqmu_app_add_settings_notice(
            'Consulting payment recipient wallet must be a valid EVM address. The previous recipient wallet was kept.',
            'invalid_consulting_payment_recipient'
        );
        $recipient_wallet = $current['recipientWallet'] ?? $defaults['recipientWallet'];
    }

    $tokens = sqmu_app_sanitize_consulting_payment_tokens(
        $profile_input['tokens'] ?? null,
        $allowed_chain_ids,
        array()
    );

    return array(
        'recipientWallet' => $recipient_wallet,
        'fixedAmount' => $fixed_amount,
        'receiptWebhookUrl' => esc_url_raw($profile_input['receiptWebhookUrl'] ?? $current['receiptWebhookUrl'] ?? $defaults['receiptWebhookUrl']),
        'calendlyUrl' => esc_url_raw($profile_input['calendlyUrl'] ?? $current['calendlyUrl'] ?? $defaults['calendlyUrl']),
        'allowedChainIds' => $allowed_chain_ids,
        'tokens' => $tokens
    );
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

    $chains = sqmu_app_sanitize_chain_rows(
        $input['chains'] ?? null,
        $current['chains'] ?? $defaults['chains'],
        $input['chains_json'] ?? ''
    );

    return array(
        'version' => 1,
        'app' => array(
            'name' => sanitize_text_field($app_input['name'] ?? $defaults['app']['name']),
            'url' => esc_url_raw($app_input['url'] ?? $defaults['app']['url']),
            'infuraApiKey' => sanitize_text_field($app_input['infuraApiKey'] ?? '')
        ),
        'chains' => $chains,
        'contracts' => sqmu_app_sanitize_contracts($contracts_input, $defaults['contracts']),
        'paymentTokens' => sqmu_app_sanitize_payment_token_rows(
            $input['paymentTokens'] ?? null,
            $current['paymentTokens'] ?? $defaults['paymentTokens'],
            $input['payment_tokens_json'] ?? ''
        ),
        'consultingPayment' => sqmu_app_sanitize_consulting_payment_settings(
            $input['consultingPayment'] ?? array(),
            $defaults['consultingPayment'],
            $current['consultingPayment'] ?? $defaults['consultingPayment'],
            $chains
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

    sqmu_app_refresh_contract_bundle_pin_mirror();
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

    $deployments_hook = add_submenu_page(
        'options-general.php',
        'SQMU Deployments',
        'SQMU Deployments',
        'manage_options',
        'sqmu-app-deployments',
        'sqmu_app_render_deployments_page'
    );

    if ($deployments_hook) {
        $GLOBALS['sqmu_app_deployments_hook'] = $deployments_hook;
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

function sqmu_app_get_consulting_payment_token_row_markup($index, $token = array(), $chains = array()) {
    $option_name = esc_attr(SQMU_APP_OPTION_KEY);
    $selected_chain_id = isset($token['chainId']) && is_numeric($token['chainId']) ? (int) $token['chainId'] : 0;

    ob_start();
    ?>
    <tr data-sqmu-repeatable-item>
        <td>
            <select name="<?php echo $option_name; ?>[consultingPayment][tokens][<?php echo esc_attr($index); ?>][chainId]" data-sqmu-row-field="chainId">
                <option value="">Select chain</option>
                <?php foreach ($chains as $chain) : ?>
                    <?php $chain_id = isset($chain['id']) ? (int) $chain['id'] : 0; ?>
                    <option value="<?php echo esc_attr($chain_id); ?>" <?php selected($selected_chain_id, $chain_id); ?>>
                        <?php echo esc_html(($chain['name'] ?? 'Chain') . ' (' . $chain_id . ')'); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </td>
        <td><input name="<?php echo $option_name; ?>[consultingPayment][tokens][<?php echo esc_attr($index); ?>][address]" type="text" class="large-text code" value="<?php echo esc_attr($token['address'] ?? ''); ?>" data-sqmu-row-field="address" /></td>
        <td><input name="<?php echo $option_name; ?>[consultingPayment][tokens][<?php echo esc_attr($index); ?>][symbol]" type="text" class="small-text" value="<?php echo esc_attr($token['symbol'] ?? ''); ?>" data-sqmu-row-field="symbol" /></td>
        <td><input name="<?php echo $option_name; ?>[consultingPayment][tokens][<?php echo esc_attr($index); ?>][decimals]" type="number" class="small-text" value="<?php echo esc_attr($token['decimals'] ?? 18); ?>" data-sqmu-row-field="decimals" /></td>
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
    $consulting_payment = isset($settings['consultingPayment']) && is_array($settings['consultingPayment'])
        ? $settings['consultingPayment']
        : sqmu_app_default_consulting_payment_settings();
    $consulting_payment_tokens = !empty($consulting_payment['tokens']) && is_array($consulting_payment['tokens'])
        ? array_values($consulting_payment['tokens'])
        : array();
    $consulting_chain_ids = !empty($consulting_payment['allowedChainIds']) && is_array($consulting_payment['allowedChainIds'])
        ? array_map('intval', $consulting_payment['allowedChainIds'])
        : array();
    ?>
    <div class="wrap">
        <h1>SQMU App Settings</h1>
        <?php settings_errors(SQMU_APP_OPTION_KEY); ?>
        <p>Configure accepted chains, contract addresses, payment tokens, the consulting payment profile, and per-view defaults for the shortcode-driven wallet application.</p>
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

            <h2>Consulting payment</h2>
            <p>Configure the direct stablecoin payment widget used by <code>[sqmu_payment]</code>. This profile controls the consulting payment recipient wallet, the fixed amount, the receipt webhook, the Calendly redirect, and the chain-specific stablecoin options shown to payers.</p>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sqmu-consulting-recipient">Recipient wallet</label></th>
                    <td><input id="sqmu-consulting-recipient" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[consultingPayment][recipientWallet]" type="text" class="regular-text code" value="<?php echo esc_attr($consulting_payment['recipientWallet'] ?? ''); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-consulting-amount">Fixed amount</label></th>
                    <td><input id="sqmu-consulting-amount" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[consultingPayment][fixedAmount]" type="text" class="small-text" value="<?php echo esc_attr($consulting_payment['fixedAmount'] ?? ''); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-consulting-receipt-url">Receipt webhook URL</label></th>
                    <td><input id="sqmu-consulting-receipt-url" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[consultingPayment][receiptWebhookUrl]" type="url" class="large-text" value="<?php echo esc_attr($consulting_payment['receiptWebhookUrl'] ?? ''); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="sqmu-consulting-calendly-url">Calendly redirect URL</label></th>
                    <td><input id="sqmu-consulting-calendly-url" name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[consultingPayment][calendlyUrl]" type="url" class="large-text" value="<?php echo esc_attr($consulting_payment['calendlyUrl'] ?? ''); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row">Allowed chains</th>
                    <td>
                        <?php foreach ($chains as $chain) : ?>
                            <?php $chain_id = isset($chain['id']) ? (int) $chain['id'] : 0; ?>
                            <p>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="<?php echo esc_attr(SQMU_APP_OPTION_KEY); ?>[consultingPayment][allowedChainIds][]"
                                        value="<?php echo esc_attr($chain_id); ?>"
                                        <?php checked(in_array($chain_id, $consulting_chain_ids, true)); ?>
                                    />
                                    <?php echo esc_html(($chain['name'] ?? 'Chain') . ' (' . $chain_id . ')'); ?>
                                </label>
                            </p>
                        <?php endforeach; ?>
                    </td>
                </tr>
            </table>

            <h3>Consulting payment tokens</h3>
            <p>Add a stablecoin for one of the allowed chains, then review or edit the saved chain-specific payment tokens in the table.</p>
            <div data-sqmu-repeatable data-next-index="<?php echo esc_attr(count($consulting_payment_tokens)); ?>">
                <div class="sqmu-add-grid sqmu-add-grid-tokens">
                    <p>
                        <label>
                            Chain<br />
                            <select class="regular-text" data-sqmu-add-field="chainId">
                                <option value="">Select chain</option>
                                <?php foreach ($chains as $chain) : ?>
                                    <?php $chain_id = isset($chain['id']) ? (int) $chain['id'] : 0; ?>
                                    <option value="<?php echo esc_attr($chain_id); ?>">
                                        <?php echo esc_html(($chain['name'] ?? 'Chain') . ' (' . $chain_id . ')'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </label>
                    </p>
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
                <p class="sqmu-add-actions"><button type="button" class="button" data-sqmu-repeatable-add>Add consulting payment token</button></p>
                <div class="sqmu-settings-table-wrap">
                    <table class="widefat striped sqmu-settings-table">
                        <thead>
                            <tr>
                                <th>Chain</th>
                                <th>Address</th>
                                <th>Symbol</th>
                                <th>Decimals</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody data-sqmu-repeatable-list>
                            <?php foreach ($consulting_payment_tokens as $index => $token) : ?>
                                <?php echo sqmu_app_get_consulting_payment_token_row_markup($index, $token, $chains); ?>
                            <?php endforeach; ?>
                            <tr class="sqmu-empty-row" data-sqmu-empty-row hidden>
                                <td colspan="5">No consulting payment tokens added yet.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <template><?php echo sqmu_app_get_consulting_payment_token_row_markup('__INDEX__', array(), $chains); ?></template>
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

function sqmu_app_get_chain_labels_by_id() {
    $settings = sqmu_app_get_settings();
    $labels = array();

    foreach ($settings['chains'] as $chain) {
        if (!isset($chain['id']) || !is_numeric($chain['id'])) {
            continue;
        }

        $chain_id = (int) $chain['id'];
        $chain_name = sanitize_text_field($chain['name'] ?? '');
        $labels[$chain_id] = $chain_name !== '' ? sprintf('%s (%d)', $chain_name, $chain_id) : sprintf('Chain %d', $chain_id);
    }

    return $labels;
}

function sqmu_app_format_chain_label($chain_id, $chain_labels) {
    if (!is_numeric($chain_id) || (int) $chain_id <= 0) {
        return 'Unknown';
    }

    $chain_id = (int) $chain_id;
    return $chain_labels[$chain_id] ?? sprintf('Chain %d', $chain_id);
}

function sqmu_app_render_code_cell($value) {
    if (!is_string($value) || trim($value) === '') {
        return '&mdash;';
    }

    return '<code>' . esc_html($value) . '</code>';
}

function sqmu_app_render_deployments_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $packaged_pin = sqmu_app_get_packaged_contract_bundle_pin();
    $stored_pin = sqmu_app_get_stored_contract_bundle_pin();
    $manifest = sqmu_app_get_packaged_contract_manifest();
    $manifest_sha256 = sqmu_app_get_packaged_contract_manifest_sha256();
    $deployments = sqmu_app_get_contract_deployments();
    $active_deployments = sqmu_app_get_active_contract_deployments();
    $chain_labels = sqmu_app_get_chain_labels_by_id();
    $deployment_count = count($deployments);
    $has_deployments = $deployment_count > 0;
    ?>
    <div class="wrap">
        <h1>SQMU Deployments</h1>
        <p>This screen shows the contract bundle pinned into the plugin package, the deployment history currently recorded on this WordPress site, and the browser-signed deployment console for creating new deployment records.</p>
        <style>
            .sqmu-deploy-grid {
                display: grid;
                gap: 16px;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                margin: 16px 0 24px;
            }

            .sqmu-deploy-card {
                background: #fff;
                border: 1px solid #dcdcde;
                border-radius: 8px;
                padding: 16px;
            }

            .sqmu-deploy-card h2,
            .sqmu-deploy-card h3 {
                margin-top: 0;
            }

            .sqmu-deploy-card p {
                margin-bottom: 0;
            }

            .sqmu-deploy-table {
                margin: 16px 0 24px;
            }

            .sqmu-deploy-table code {
                word-break: break-word;
            }

            .sqmu-deploy-table td,
            .sqmu-deploy-table th {
                vertical-align: top;
            }

            .sqmu-deploy-record {
                margin: 0 0 16px;
                background: #fff;
                border: 1px solid #dcdcde;
                border-radius: 8px;
                padding: 12px 16px;
            }

            .sqmu-deploy-record summary {
                cursor: pointer;
                font-weight: 600;
                margin: -12px -16px 12px;
                padding: 12px 16px;
            }

            .sqmu-deploy-badge {
                display: inline-block;
                border-radius: 999px;
                background: #f0f0f1;
                padding: 2px 8px;
                font-size: 12px;
                line-height: 1.8;
                text-transform: uppercase;
                letter-spacing: 0.03em;
            }

            .sqmu-deploy-badge-active {
                background: #dff6dd;
                color: #0f5132;
            }

            .sqmu-deploy-badge-failed {
                background: #fbeaea;
                color: #8a2424;
            }

            .sqmu-deploy-badge-superseded {
                background: #e8f0fe;
                color: #1d4ed8;
            }
        </style>

        <?php if (!empty($packaged_pin['enabled']) && !$manifest) : ?>
            <div class="notice notice-warning inline"><p>The plugin pin is enabled, but no bundled <code>contracts/current/manifest.json</code> was found in this plugin build.</p></div>
        <?php elseif (!$packaged_pin['enabled']) : ?>
            <div class="notice notice-info inline"><p>This plugin build is currently pinned with contract bundling disabled. The deployment console is still ready to show history once deployments are recorded.</p></div>
        <?php elseif ($manifest) : ?>
            <div class="notice notice-success inline"><p>A bundled contract manifest is packaged with this plugin build and ready for review.</p></div>
        <?php endif; ?>

        <div class="sqmu-deploy-grid">
            <div class="sqmu-deploy-card">
                <h2>Pinned Bundle</h2>
                <p><strong>Version:</strong> <?php echo esc_html($packaged_pin['release']['version'] ?: 'Not pinned'); ?></p>
                <p><strong>Tag:</strong> <?php echo esc_html($packaged_pin['release']['tag'] ?: 'Not set'); ?></p>
                <p><strong>Bundled Manifest:</strong> <?php echo esc_html($manifest ? 'Present' : 'Not packaged'); ?></p>
            </div>
            <div class="sqmu-deploy-card">
                <h2>Recorded Deployments</h2>
                <p><strong>History Records:</strong> <?php echo esc_html((string) $deployment_count); ?></p>
                <p><strong>Active Chains:</strong> <?php echo esc_html((string) count($active_deployments)); ?></p>
                <p><strong>Site Has Deployments:</strong> <?php echo esc_html($has_deployments ? 'Yes' : 'No'); ?></p>
            </div>
            <div class="sqmu-deploy-card">
                <h2>Manifest Integrity</h2>
                <p><strong>Release Version:</strong> <?php echo esc_html($manifest['releaseVersion'] ?? 'Unavailable'); ?></p>
                <p><strong>EVM Target:</strong> <?php echo esc_html($manifest['evmVersion'] ?? 'Unavailable'); ?></p>
                <p><strong>SHA-256:</strong> <?php echo $manifest_sha256 !== '' ? sqmu_app_render_code_cell($manifest_sha256) : '&mdash;'; ?></p>
            </div>
        </div>

        <h2>Bundle Metadata</h2>
        <table class="widefat striped sqmu-deploy-table">
            <tbody>
                <tr>
                    <th scope="row">Pin enabled</th>
                    <td><?php echo !empty($packaged_pin['enabled']) ? 'Yes' : 'No'; ?></td>
                </tr>
                <tr>
                    <th scope="row">Pinned release version</th>
                    <td><?php echo sqmu_app_render_code_cell($packaged_pin['release']['version'] ?? ''); ?></td>
                </tr>
                <tr>
                    <th scope="row">Pinned release tag</th>
                    <td><?php echo sqmu_app_render_code_cell($packaged_pin['release']['tag'] ?? ''); ?></td>
                </tr>
                <tr>
                    <th scope="row">Pinned release asset</th>
                    <td><?php echo sqmu_app_render_code_cell($packaged_pin['release']['asset'] ?? ''); ?></td>
                </tr>
                <tr>
                    <th scope="row">Pinned release checksum</th>
                    <td><?php echo sqmu_app_render_code_cell($packaged_pin['release']['sha256'] ?? ''); ?></td>
                </tr>
                <tr>
                    <th scope="row">Mirrored option version</th>
                    <td><?php echo sqmu_app_render_code_cell($stored_pin['release']['version'] ?? ''); ?></td>
                </tr>
                <tr>
                    <th scope="row">Manifest present in plugin package</th>
                    <td><?php echo $manifest ? 'Yes' : 'No'; ?></td>
                </tr>
                <tr>
                    <th scope="row">Recorded deployment history</th>
                    <td><?php echo $has_deployments ? sprintf('Yes (%d record%s)', $deployment_count, $deployment_count === 1 ? '' : 's') : 'No'; ?></td>
                </tr>
            </tbody>
        </table>

        <h2>Active Deployments By Chain</h2>
        <?php if (empty($active_deployments)) : ?>
            <p>No active deployments are recorded yet.</p>
        <?php else : ?>
            <table class="widefat striped sqmu-deploy-table">
                <thead>
                    <tr>
                        <th>Chain</th>
                        <th>Deployment ID</th>
                        <th>Release Version</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($active_deployments as $chain_id => $deployment_id) : ?>
                        <?php $record = $deployments[$deployment_id] ?? null; ?>
                        <tr>
                            <td><?php echo esc_html(sqmu_app_format_chain_label($chain_id, $chain_labels)); ?></td>
                            <td><?php echo sqmu_app_render_code_cell($deployment_id); ?></td>
                            <td><?php echo sqmu_app_render_code_cell($record['releaseVersion'] ?? ''); ?></td>
                            <td><?php echo esc_html($record['status'] ?? 'Unknown'); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <h2>Contracts In Bundled Manifest</h2>
        <?php if (!$manifest || empty($manifest['contracts']) || !is_array($manifest['contracts'])) : ?>
            <p>No bundled manifest contracts are available in this plugin build yet.</p>
        <?php else : ?>
            <table class="widefat striped sqmu-deploy-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Contract</th>
                        <th>Deployment Kind</th>
                        <th>Depends On</th>
                        <th>Initializer</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach (array_values($manifest['contracts']) as $index => $contract) : ?>
                        <?php
                        $depends_on = isset($contract['dependsOn']) && is_array($contract['dependsOn']) ? implode(', ', array_map('sanitize_text_field', $contract['dependsOn'])) : '';
                        $initializer = isset($contract['initializer']) && is_array($contract['initializer'])
                            ? sanitize_text_field($contract['initializer']['method'] ?? '') . '(' . implode(', ', array_map('sanitize_text_field', $contract['initializer']['args'] ?? array())) . ')'
                            : 'None';
                        ?>
                        <tr>
                            <td><?php echo esc_html((string) ($index + 1)); ?></td>
                            <td><?php echo esc_html($contract['name'] ?? 'Unknown'); ?></td>
                            <td><?php echo esc_html($contract['deploymentKind'] ?? 'Unknown'); ?></td>
                            <td><?php echo esc_html($depends_on !== '' ? $depends_on : 'None'); ?></td>
                            <td><?php echo esc_html($initializer); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <h2>Upgradeability Metadata</h2>
            <table class="widefat striped sqmu-deploy-table">
                <thead>
                    <tr>
                        <th>Contract</th>
                        <th>Upgrade Allowed</th>
                        <th>Default Action</th>
                        <th>Review Required</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($manifest['contracts'] as $contract) : ?>
                        <?php $upgrade = isset($contract['upgrade']) && is_array($contract['upgrade']) ? $contract['upgrade'] : array(); ?>
                        <tr>
                            <td><?php echo esc_html($contract['name'] ?? 'Unknown'); ?></td>
                            <td><?php echo !empty($upgrade['allowed']) ? 'Yes' : 'No'; ?></td>
                            <td><?php echo esc_html($upgrade['defaultAction'] ?? 'Unavailable'); ?></td>
                            <td><?php echo !empty($upgrade['reviewRequired']) ? 'Yes' : 'No'; ?></td>
                            <td><?php echo esc_html($upgrade['notes'] ?? ''); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <h2>Recorded Deployment History</h2>
        <?php if (!$has_deployments) : ?>
            <p>No deployment history is recorded on this site yet.</p>
        <?php else : ?>
            <?php foreach ($deployments as $deployment) : ?>
                <?php
                $status_class = 'sqmu-deploy-badge';
                if ($deployment['status'] === 'active') {
                    $status_class .= ' sqmu-deploy-badge-active';
                } elseif ($deployment['status'] === 'failed') {
                    $status_class .= ' sqmu-deploy-badge-failed';
                } elseif ($deployment['status'] === 'superseded') {
                    $status_class .= ' sqmu-deploy-badge-superseded';
                }
                ?>
                <details class="sqmu-deploy-record">
                    <summary>
                        <?php echo esc_html($deployment['deploymentId']); ?>
                        ·
                        <?php echo esc_html(sqmu_app_format_chain_label($deployment['chainId'], $chain_labels)); ?>
                        ·
                        <span class="<?php echo esc_attr($status_class); ?>"><?php echo esc_html($deployment['status']); ?></span>
                    </summary>

                    <table class="widefat striped sqmu-deploy-table">
                        <tbody>
                            <tr>
                                <th scope="row">Release Version</th>
                                <td><?php echo sqmu_app_render_code_cell($deployment['releaseVersion']); ?></td>
                            </tr>
                            <tr>
                                <th scope="row">Manifest Version</th>
                                <td><?php echo sqmu_app_render_code_cell($deployment['manifestVersion']); ?></td>
                            </tr>
                            <tr>
                                <th scope="row">Manifest SHA-256</th>
                                <td><?php echo sqmu_app_render_code_cell($deployment['manifestSha256']); ?></td>
                            </tr>
                            <tr>
                                <th scope="row">Deployed At</th>
                                <td><?php echo esc_html($deployment['deployedAt'] !== '' ? $deployment['deployedAt'] : 'Unavailable'); ?></td>
                            </tr>
                            <tr>
                                <th scope="row">Deployer Wallet</th>
                                <td><?php echo sqmu_app_render_code_cell($deployment['deployerWallet']); ?></td>
                            </tr>
                        </tbody>
                    </table>

                    <h3>Contracts</h3>
                    <?php if (empty($deployment['contracts'])) : ?>
                        <p>No deployed contract addresses are stored on this record yet.</p>
                    <?php else : ?>
                        <table class="widefat striped sqmu-deploy-table">
                            <thead>
                                <tr>
                                    <th>Contract</th>
                                    <th>Deployment Kind</th>
                                    <th>Address</th>
                                    <th>Proxy Address</th>
                                    <th>Implementation Address</th>
                                    <th>Tx Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($deployment['contracts'] as $contract) : ?>
                                    <tr>
                                        <td><?php echo esc_html($contract['name']); ?></td>
                                        <td><?php echo esc_html($contract['deploymentKind'] !== '' ? $contract['deploymentKind'] : 'Unavailable'); ?></td>
                                        <td><?php echo sqmu_app_render_code_cell($contract['address']); ?></td>
                                        <td><?php echo sqmu_app_render_code_cell($contract['proxyAddress']); ?></td>
                                        <td><?php echo sqmu_app_render_code_cell($contract['implementationAddress']); ?></td>
                                        <td><?php echo sqmu_app_render_code_cell($contract['txHash']); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>

                    <h3>Transaction Hashes</h3>
                    <?php if (empty($deployment['txHashes'])) : ?>
                        <p>No additional transaction hashes are stored on this record yet.</p>
                    <?php else : ?>
                        <table class="widefat striped sqmu-deploy-table">
                            <thead>
                                <tr>
                                    <th>Label</th>
                                    <th>Tx Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($deployment['txHashes'] as $label => $hash) : ?>
                                    <tr>
                                        <td><?php echo esc_html($label); ?></td>
                                        <td><?php echo sqmu_app_render_code_cell($hash); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </details>
            <?php endforeach; ?>
        <?php endif; ?>

        <h2>Browser Deployment Console</h2>
        <p>The connected wallet signs deployment transactions in your browser. Saving a successful deployment record is handled through the WordPress REST API with administrator permissions.</p>
        <div id="sqmu-admin-deploy" data-sqmu-app="1" data-sqmu-view="admin_deploy" class="sqmu-widget wp-block-group is-layout-flow"></div>
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
        return has_shortcode($post->post_content, 'sqmu_app') || has_shortcode($post->post_content, 'sqmu_payment');
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

    foreach (sqmu_app_get_imported_scenario_properties() as $record) {
        if (!is_array($record) || empty($record['propertyCode'])) {
            continue;
        }

        if (isset($seen[$record['propertyCode']])) {
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
        'chains' => $settings['chains']
    );
}

function sqmu_app_build_mount_config($view, $property_code, $escrow_address = '', $context = 'public') {
    $settings = sqmu_app_get_settings();
    if ($view === 'payment') {
        $profile = isset($settings['consultingPayment']) && is_array($settings['consultingPayment'])
            ? $settings['consultingPayment']
            : sqmu_app_default_consulting_payment_settings();
        $allowed_chain_ids = isset($profile['allowedChainIds']) && is_array($profile['allowedChainIds'])
            ? array_map('intval', $profile['allowedChainIds'])
            : array();
        $payment_chains = array_values(
            array_filter(
                $settings['chains'],
                static function ($chain) use ($allowed_chain_ids) {
                    return isset($chain['id']) && in_array((int) $chain['id'], $allowed_chain_ids, true);
                }
            )
        );
        $payment_tokens = array_values(
            array_filter(
                isset($profile['tokens']) && is_array($profile['tokens']) ? $profile['tokens'] : array(),
                static function ($token) use ($allowed_chain_ids) {
                    return isset($token['chainId']) && in_array((int) $token['chainId'], $allowed_chain_ids, true);
                }
            )
        );
        $default_chain_id = !empty($payment_chains[0]['id'])
            ? (int) $payment_chains[0]['id']
            : (!empty($settings['chains'][0]['id']) ? (int) $settings['chains'][0]['id'] : 0);

        return array(
            'view' => 'payment',
            'config' => array(
                'version' => 1,
                'context' => $context,
                'app' => $settings['app'],
                'currentUser' => array(
                    'canManageOptions' => current_user_can('manage_options')
                ),
                'chains' => $payment_chains,
                'defaultChainId' => $default_chain_id,
                'consultingPayment' => array(
                    'recipientWallet' => $profile['recipientWallet'] ?? '',
                    'fixedAmount' => $profile['fixedAmount'] ?? '',
                    'receiptWebhookUrl' => $profile['receiptWebhookUrl'] ?? '',
                    'calendlyUrl' => $profile['calendlyUrl'] ?? '',
                    'allowedChainIds' => $allowed_chain_ids,
                    'tokens' => $payment_tokens
                )
            ),
            'errors' => array()
        );
    }

    if ($view === 'admin_deploy') {
        $bundle = sqmu_app_get_packaged_contract_bundle();
        $default_chain_id = !empty($settings['chains'][0]['id']) ? (int) $settings['chains'][0]['id'] : 0;

        return array(
            'view' => 'admin_deploy',
            'config' => array(
                'version' => 1,
                'context' => $context,
                'app' => $settings['app'],
                'currentUser' => array(
                    'canManageOptions' => current_user_can('manage_options')
                ),
                'chains' => $settings['chains'],
                'defaultChainId' => $default_chain_id,
                'deploymentBundle' => array(
                    'available' => is_array($bundle),
                    'pin' => sqmu_app_get_packaged_contract_bundle_pin(),
                    'manifest' => $bundle['manifest'] ?? null,
                    'manifestSha256' => $bundle['manifestSha256'] ?? '',
                    'contracts' => $bundle['contracts'] ?? array(),
                    'support' => $bundle['support'] ?? array()
                ),
                'deploymentRecords' => array_values(sqmu_app_get_contract_deployments()),
                'activeDeployments' => sqmu_app_get_active_contract_deployments(),
                'adminApi' => array(
                    'baseUrl' => esc_url_raw(rest_url('sqmu/v1')),
                    'nonce' => wp_create_nonce('wp_rest')
                )
            ),
            'errors' => array()
        );
    }

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
    $deployments_hook = $GLOBALS['sqmu_app_deployments_hook'] ?? '';
    if ($hook_suffix !== $operations_hook && $hook_suffix !== $deployments_hook) {
        return;
    }

    if (!current_user_can('manage_options')) {
        return;
    }

    $mounts = array();
    if ($hook_suffix === $operations_hook) {
        $mounts['sqmu-admin-ops'] = sqmu_app_build_mount_config('admin_ops', '', '', 'admin');
    }
    if ($hook_suffix === $deployments_hook) {
        $mounts['sqmu-admin-deploy'] = sqmu_app_build_mount_config('admin_deploy', '', '', 'admin');
    }

    $payload = array(
        'global' => sqmu_app_get_runtime_global_config('admin'),
        'mounts' => $mounts
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

function sqmu_app_register_payment_mount() {
    if (!isset($GLOBALS['sqmu_app_mounts'])) {
        $GLOBALS['sqmu_app_mounts'] = array();
    }

    $mount_id = 'sqmu-payment-' . wp_generate_uuid4();
    $GLOBALS['sqmu_app_mounts'][$mount_id] = sqmu_app_build_mount_config('payment', '', '', 'public');
    $GLOBALS['sqmu_app_needs_assets'] = true;

    return sprintf(
        '<div id="%s" data-sqmu-app="1" data-sqmu-view="payment" class="sqmu-widget wp-block-group is-layout-flow"></div>',
        esc_attr($mount_id)
    );
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

function sqmu_payment_shortcode($atts) {
    shortcode_atts(array(), $atts, 'sqmu_payment');
    return sqmu_app_register_payment_mount();
}
add_shortcode('sqmu_payment', 'sqmu_payment_shortcode');
