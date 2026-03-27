import {
  ChainNotConfiguredError,
  createConnector
} from 'wagmi';
import {
  getAddress,
  numberToHex,
  ResourceUnavailableRpcError,
  SwitchChainError,
  UserRejectedRequestError,
  withRetry,
  withTimeout
} from 'viem';

metaMask.type = 'metaMask';

export function metaMask(parameters = {}) {
  let metamask;
  let metamaskPromise;

  return createConnector((config) => ({
    id: 'metaMaskSDK',
    name: 'MetaMask',
    rdns: ['io.metamask', 'io.metamask.mobile'],
    type: metaMask.type,
    async connect({ chainId, isReconnecting, withCapabilities } = {}) {
      const instance = await this.getInstance();
      const provider = instance.getProvider();
      let accounts = [];

      if (isReconnecting) {
        accounts = await this.getAccounts().catch(() => []);
      }

      try {
        let signResponse;
        let connectWithResponse;

        if (!accounts.length) {
          const chainIds = config.chains.map((chain) => numberToHex(chain.id));

          if (parameters.connectAndSign || parameters.connectWith) {
            if (parameters.connectAndSign) {
              signResponse = await instance.connectAndSign({
                chainIds,
                message: parameters.connectAndSign
              });
            } else if (parameters.connectWith) {
              connectWithResponse = await instance.connectWith({
                chainIds,
                method: parameters.connectWith.method,
                params: parameters.connectWith.params
              });
            }

            accounts = await this.getAccounts();
          } else {
            const result = await instance.connect({ chainIds });
            accounts = result.accounts.map((account) => getAddress(account));
          }
        }

        let currentChainId = await this.getChainId();
        if (chainId && currentChainId !== chainId) {
          const chain = await this.switchChain({ chainId }).catch((error) => {
            if (error.code === UserRejectedRequestError.code) {
              throw error;
            }

            return { id: currentChainId };
          });
          currentChainId = chain?.id ?? currentChainId;
        }

        if (signResponse) {
          provider.emit('connectAndSign', {
            accounts,
            chainId: numberToHex(currentChainId),
            signResponse
          });
        } else if (connectWithResponse) {
          provider.emit('connectWith', {
            accounts,
            chainId: numberToHex(currentChainId),
            connectWithResponse
          });
        }

        return {
          accounts: withCapabilities
            ? accounts.map((address) => ({ address, capabilities: {} }))
            : accounts,
          chainId: currentChainId
        };
      } catch (error) {
        if (error?.code === UserRejectedRequestError.code) {
          throw new UserRejectedRequestError(error);
        }
        if (error?.code === ResourceUnavailableRpcError.code) {
          throw new ResourceUnavailableRpcError(error);
        }
        throw error;
      }
    },
    async disconnect() {
      const instance = await this.getInstance();
      await instance.disconnect();
    },
    async getAccounts() {
      const instance = await this.getInstance();
      if (instance.accounts.length) {
        return instance.accounts.map((account) => getAddress(account));
      }

      const provider = instance.getProvider();
      const accounts = await provider.request({ method: 'eth_accounts' });
      return accounts.map((account) => getAddress(account));
    },
    async getChainId() {
      const instance = await this.getInstance();
      if (instance.getChainId()) {
        return Number(instance.getChainId());
      }

      const provider = instance.getProvider();
      const chainId = await provider.request({ method: 'eth_chainId' });
      return Number(chainId);
    },
    async getProvider() {
      const instance = await this.getInstance();
      return instance.getProvider();
    },
    async isAuthorized() {
      try {
        const timeout = 10;
        const accounts = await withRetry(
          async () =>
            withTimeout(async () => {
              const resolvedAccounts = await this.getAccounts();
              if (!resolvedAccounts.length) {
                throw new Error('try again');
              }
              return resolvedAccounts;
            }, { timeout }),
          { delay: timeout + 1, retryCount: 3 }
        );

        return Boolean(accounts.length);
      } catch {
        return false;
      }
    },
    async switchChain({ addEthereumChainParameter, chainId }) {
      const chain = config.chains.find(({ id }) => id === Number(chainId));
      if (!chain) {
        throw new SwitchChainError(new ChainNotConfiguredError());
      }

      const hexChainId = numberToHex(chainId);

      try {
        const instance = await this.getInstance();
        await instance.switchChain({
          chainId: hexChainId,
          chainConfiguration: {
            blockExplorerUrls: addEthereumChainParameter?.blockExplorerUrls
              ? [...addEthereumChainParameter.blockExplorerUrls]
              : chain.blockExplorers?.default.url
                ? [chain.blockExplorers.default.url]
                : undefined,
            chainId: hexChainId,
            chainName: addEthereumChainParameter?.chainName ?? chain.name,
            iconUrls: addEthereumChainParameter?.iconUrls,
            nativeCurrency: addEthereumChainParameter?.nativeCurrency ?? chain.nativeCurrency,
            rpcUrls: addEthereumChainParameter?.rpcUrls
              ? [...addEthereumChainParameter.rpcUrls]
              : chain.rpcUrls.default?.http
                ? [...chain.rpcUrls.default.http]
                : undefined
          }
        });

        return chain;
      } catch (error) {
        if (error?.code === UserRejectedRequestError.code) {
          throw new UserRejectedRequestError(error);
        }

        throw new SwitchChainError(error);
      }
    },
    async onAccountsChanged(accounts) {
      config.emitter.emit('change', {
        accounts: accounts.map((account) => getAddress(account))
      });
    },
    onChainChanged(chain) {
      config.emitter.emit('change', { chainId: Number(chain) });
    },
    async onConnect(connectInfo) {
      const accounts = await this.getAccounts();
      if (!accounts.length) {
        return;
      }

      config.emitter.emit('connect', {
        accounts,
        chainId: Number(connectInfo.chainId)
      });
    },
    async onDisconnect(error) {
      if (error?.code === 1013) {
        const provider = await this.getProvider();
        if (provider && (await this.getAccounts()).length) {
          return;
        }
      }

      config.emitter.emit('disconnect');
    },
    onDisplayUri(uri) {
      config.emitter.emit('message', { type: 'display_uri', data: uri });
    },
    async getInstance() {
      if (!metamask) {
        if (!metamaskPromise) {
          metamaskPromise = (async () => {
            const { createEVMClient } = await import('@metamask/connect-evm');
            const defaultDapp = typeof window === 'undefined'
              ? { name: 'SQMU Wallet' }
              : { name: window.location.hostname, url: window.location.href };

            return createEVMClient({
              ...parameters,
              api: {
                supportedNetworks: Object.fromEntries(
                  config.chains.map((chain) => [
                    numberToHex(chain.id),
                    chain.rpcUrls.default?.http[0] ?? ''
                  ])
                )
              },
              dapp: parameters.dapp ?? {
                ...defaultDapp,
                ...parameters.dappMetadata
              },
              debug: parameters.debug ?? parameters.logging?.sdk,
              eventHandlers: {
                accountsChanged: this.onAccountsChanged.bind(this),
                chainChanged: this.onChainChanged.bind(this),
                connect: this.onConnect.bind(this),
                disconnect: this.onDisconnect.bind(this),
                displayUri: this.onDisplayUri.bind(this)
              },
              analytics: {
                integrationType: 'wagmi'
              },
              ui: {
                ...parameters.ui,
                ...(parameters.headless != null ? { headless: parameters.headless } : {})
              },
              ...(parameters.mobile ? { mobile: parameters.mobile } : {})
            });
          })();
        }

        metamask = await metamaskPromise;
      }

      return metamask;
    }
  }));
}
