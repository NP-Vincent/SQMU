import { MetaMaskSDK } from '@metamask/sdk';
import { BrowserProvider } from 'ethers';

const DEFAULT_DAPP_METADATA = {
  name: 'SQMU Distributor',
  url: typeof window !== 'undefined' ? window.location.href : ''
};

export function createWalletState(config = {}) {
  const listeners = new Set();
  let activeProviderHandlers = null;
  const sdkOptions = {
    dappMetadata: config.dappMetadata ?? DEFAULT_DAPP_METADATA,
    infuraAPIKey: config.infuraApiKey ?? config.infuraAPIKey
  };
  if (config.sdkOptions && typeof config.sdkOptions === 'object') {
    Object.assign(sdkOptions, config.sdkOptions);
  }
  const transportOverrides = {
    communicationLayerPreference:
      config.communicationLayerPreference ?? config.sdkCommunicationLayerPreference,
    preferDesktop: config.preferDesktop ?? config.sdkPreferDesktop,
    transport: config.transport ?? config.sdkTransport,
    transports: config.transports ?? config.sdkTransports
  };
  Object.entries(transportOverrides).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      sdkOptions[key] = value;
    }
  });
  const sdk = new MetaMaskSDK(sdkOptions);

  const normalizeChainId = (chainId) => {
    if (typeof chainId === 'string' && chainId.trim() !== '') {
      return chainId.startsWith('0x')
        ? Number.parseInt(chainId, 16)
        : Number.parseInt(chainId, 10);
    }
    if (typeof chainId === 'number') {
      return chainId;
    }
    return null;
  };

  const toHexChainId = (chainId) => {
    const normalized = normalizeChainId(chainId);
    if (!normalized) {
      return null;
    }
    return `0x${normalized.toString(16)}`;
  };

  const isUnknownChainError = (error) =>
    error?.code === 4902 || error?.data?.originalError?.code === 4902;

  const normalizeRpcUrls = () => {
    const urls = [];
    if (config.rpcUrl) {
      urls.push(config.rpcUrl);
    }
    if (Array.isArray(config.rpcUrls)) {
      urls.push(...config.rpcUrls);
    }
    if (Array.isArray(config.rpcUrlsFallback)) {
      urls.push(...config.rpcUrlsFallback);
    }
    return urls.filter((url) => typeof url === 'string' && url.trim() !== '');
  };

  const buildDeepLinkUrl = () => {
    if (config.deepLinkUrl) {
      return config.deepLinkUrl;
    }
    if (typeof window === 'undefined') {
      return null;
    }
    const dappUrl = window.location.href;
    if (!dappUrl) {
      return null;
    }
    const base = config.deepLinkBaseUrl ?? 'https://metamask.app.link/dapp/';
    return `${base}${encodeURIComponent(dappUrl)}`;
  };

  const recordError = (error, fallbackMessage) => {
    if (!error && !fallbackMessage) {
      state.lastError = null;
      return;
    }
    const code = error?.code ?? error?.data?.originalError?.code ?? null;
    const message =
      error?.message ||
      fallbackMessage ||
      'Something went wrong. Please try again.';
    state.lastError = {
      code,
      message,
      raw: error ?? null
    };
  };

  const requestWithTimeout = async (request, timeoutMs) => {
    if (!timeoutMs) {
      return request();
    }
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timed out. Please try again.'));
      }, timeoutMs);
    });
    try {
      return await Promise.race([request(), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const state = {
    connected: false,
    account: null,
    chainId: config.chainId ?? null,
    sdk,
    provider: null,
    ethersProvider: null,
    signer: null,
    lastError: null,
    connectionHints: null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async ensureChain(chainId = config.chainId) {
      const expected = normalizeChainId(chainId);
      if (!expected || !state.provider?.request) {
        return;
      }
      if (state.chainId && state.chainId === expected) {
        return;
      }
      const hexChainId = toHexChainId(expected);
      if (!hexChainId) {
        return;
      }
      let currentChain = null;
      try {
        await requestWithTimeout(
          () =>
            state.provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: hexChainId }]
            }),
          config.chainSwitchTimeoutMs
        );
        currentChain = await state.provider
          .request({ method: 'eth_chainId' })
          .catch(() => null);
      } catch (error) {
        if (!isUnknownChainError(error)) {
          recordError(error, 'Unable to switch networks.');
          throw error;
        }
        await state.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexChainId,
              chainName: config.chainName,
              rpcUrls: normalizeRpcUrls(),
              nativeCurrency: config.nativeCurrency,
              blockExplorerUrls: config.blockExplorerUrl
                ? [config.blockExplorerUrl]
                : []
            }
          ]
        });
        currentChain = await state.provider
          .request({ method: 'eth_chainId' })
          .catch(() => null);
        if (normalizeChainId(currentChain) !== expected) {
          await requestWithTimeout(
            () =>
              state.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }]
              }),
            config.chainSwitchTimeoutMs
          );
          currentChain = await state.provider
            .request({ method: 'eth_chainId' })
            .catch(() => null);
        }
      }
      recordError(null);
      updateChainId(currentChain ?? expected);
      notify();
    }
  };

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  const updateChainId = (chainId) => {
    if (typeof chainId === 'string') {
      state.chainId = chainId.startsWith('0x')
        ? Number.parseInt(chainId, 16)
        : Number.parseInt(chainId, 10);
    } else if (typeof chainId === 'number') {
      state.chainId = chainId;
    }
  };

  const detachProvider = () => {
    if (!state.provider || !activeProviderHandlers || !state.provider.removeListener) {
      activeProviderHandlers = null;
      return;
    }
    state.provider.removeListener('accountsChanged', activeProviderHandlers.accountsChanged);
    state.provider.removeListener('chainChanged', activeProviderHandlers.chainChanged);
    activeProviderHandlers = null;
  };

  const attachProvider = (provider) => {
    if (!provider || provider === state.provider) {
      return;
    }
    detachProvider();
    state.provider = provider;
    if (provider.on) {
      activeProviderHandlers = {
        accountsChanged: (accounts) => {
          state.account = accounts?.[0] ?? null;
          state.connected = Boolean(state.account);
          notify();
        },
        chainChanged: (chainId) => {
          updateChainId(chainId);
          notify();
        }
      };
      provider.on('accountsChanged', activeProviderHandlers.accountsChanged);

      provider.on('chainChanged', activeProviderHandlers.chainChanged);
    }
  };

  state.connect = async () => {
    try {
      recordError(null);
      state.connectionHints = null;
      const accounts = await sdk.connect();
      state.connected = Array.isArray(accounts) && accounts.length > 0;
      state.account = accounts?.[0] ?? null;
      const provider =
        sdk.getProvider() ||
        (typeof window !== 'undefined' ? window.ethereum : null);
      if (!provider) {
        const deepLinkUrl = buildDeepLinkUrl();
        state.connectionHints = {
          deepLinkUrl,
          message:
            'MetaMask provider not found. Use the MetaMask app or install the extension.'
        };
        throw new Error(
          deepLinkUrl
            ? `MetaMask provider not found. Open in MetaMask Mobile: ${deepLinkUrl}`
            : 'MetaMask provider not found. Ensure the extension is available.'
        );
      }
      attachProvider(provider);
      state.ethersProvider = new BrowserProvider(provider);
      state.signer = state.connected ? await state.ethersProvider.getSigner() : null;
      const network = await state.ethersProvider.getNetwork();
      updateChainId(Number(network.chainId));
      await state.ensureChain();
      if (state.ethersProvider) {
        const refreshedNetwork = await state.ethersProvider.getNetwork();
        updateChainId(Number(refreshedNetwork.chainId));
      }
      notify();
      return state;
    } catch (error) {
      if (error?.code === 4001) {
        recordError(error, 'Connection request was rejected.');
      } else {
        recordError(error, 'Unable to connect to MetaMask.');
      }
      notify();
      throw error;
    }
  };

  state.disconnect = async () => {
    if (typeof sdk.disconnect === 'function') {
      await sdk.disconnect();
    }
    detachProvider();
    state.connected = false;
    state.account = null;
    state.signer = null;
    state.ethersProvider = null;
    state.connectionHints = null;
    recordError(null);
    notify();
  };

  attachProvider(sdk.getProvider());

  return state;
}
