import { createWalletState } from './wallet/metamask.js';
import { mountDappUI, mountUI } from './ui/index.js';
import { initListingWidget } from './widgets/listing/index.js';
import { initPortfolioWidget } from './widgets/portfolio/index.js';

const parseDatasetConfig = (dataset) => {
  const config = {};
  Object.entries(dataset).forEach(([key, value]) => {
    if (!key.startsWith('mmwp') || key === 'mmwpWidget') {
      return;
    }
    const trimmed = key.replace(/^mmwp/, '');
    if (!trimmed) {
      return;
    }
    const configKey = `${trimmed[0].toLowerCase()}${trimmed.slice(1)}`;
    if (value === '') {
      return;
    }
    if (value === 'true' || value === 'false') {
      config[configKey] = value === 'true';
      return;
    }
    if (/^\d+$/.test(value)) {
      config[configKey] = Number.parseInt(value, 10);
      return;
    }
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        config[configKey] = JSON.parse(value);
        return;
      } catch (error) {
        // fall through to treat as string
      }
    }
    config[configKey] = value;
  });
  return config;
};

export function initMetaMaskDapp(config = {}) {
  const globalConfig = config.global ?? config;
  const mountConfigs = config.mounts ?? {};
  const mounts = document.querySelectorAll('[data-mmwp-widget]');

  if (!mounts.length) {
    const state = createWalletState(globalConfig);
    mountUI(state, globalConfig);
    return state;
  }

  const states = [];

  mounts.forEach((mount) => {
    const widget = mount.dataset.mmwpWidget;
    const mountId = mount.id;
    const mountConfig = mountId ? mountConfigs[mountId] || {} : {};
    const datasetConfig = parseDatasetConfig(mount.dataset);
    const mergedConfig = {
      ...globalConfig,
      ...mountConfig,
      ...datasetConfig
    };

    if (widget === 'metamask-dapp') {
      const state = createWalletState(mergedConfig);
      mountDappUI(mount, state, mergedConfig);
      states.push(state);
    }

    if (widget === 'sqmu-listing') {
      states.push(initListingWidget(mount, mergedConfig));
    }

    if (widget === 'sqmu-portfolio') {
      states.push(initPortfolioWidget(mount, mergedConfig));
    }
  });

  return states;
}
