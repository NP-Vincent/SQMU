import React, { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWalletClient
} from 'wagmi';
import { injected, metaMask } from 'wagmi/connectors';
import { defineChain, formatUnits } from 'viem';
import { defaultDistributorAddress, distributorAbi } from './contracts/atomicDistributor.js';
import { DEFAULT_CHAIN, DEFAULT_PAYMENT_TOKENS, DISTRIBUTOR_ADDRESS, SQMU_ADDRESS, TRADE_ADDRESS } from './config.js';
import { defaultSqmuAddress, sqmuAbi } from './contracts/sqmu.js';
import { defaultTradeAddress, tradeAbi } from './contracts/trade.js';

const SQMU_DECIMALS = 2n;
const USD_DECIMALS = 18n;
const wagmiConfigCache = new Map();
const queryClientCache = new Map();

const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
];

const VIEW_TITLES = {
  buy: 'Buy SQMU',
  listing: 'SQMU Listings',
  portfolio: 'SQMU Portfolio'
};

const maskAddress = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not connected';

const safeString = (value) => (typeof value === 'string' ? value.trim() : '');

const toBigInt = (value, fallback = 0n) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return fallback;
};

const parseSqmuUnits = (value) => {
  const trimmed = safeString(value);
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const formatSqmuUnits = (value) => {
  const units = toBigInt(value);
  const whole = units / 100n;
  const fraction = units % 100n;
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
};

const formatUsd18 = (value) => {
  const units = toBigInt(value);
  const formatted = Number(formatUnits(units, 18));
  if (Number.isNaN(formatted)) return '$0.00';
  return `$${formatted.toFixed(2)}`;
};

const formatTokenAmount = (value, decimals) => {
  try {
    return Number(formatUnits(toBigInt(value), decimals)).toLocaleString(undefined, {
      maximumFractionDigits: Math.min(decimals, 6)
    });
  } catch (error) {
    return '0';
  }
};

const calculateTokenAmount = (priceUsd18, sqmuAmountUnits, tokenDecimals) => {
  const decimals = 10n ** BigInt(tokenDecimals);
  return (toBigInt(priceUsd18) * toBigInt(sqmuAmountUnits) * decimals) / (10n ** USD_DECIMALS * 100n);
};

const normalizeNativeCurrency = (value) => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CHAIN.nativeCurrency;
  }
  return {
    name: safeString(value.name) || DEFAULT_CHAIN.nativeCurrency.name,
    symbol: safeString(value.symbol) || DEFAULT_CHAIN.nativeCurrency.symbol,
    decimals: Number.isFinite(Number(value.decimals))
      ? Number(value.decimals)
      : DEFAULT_CHAIN.nativeCurrency.decimals
  };
};

const normalizeChain = (value, fallbackId) => {
  const id = Number(value?.id ?? fallbackId ?? DEFAULT_CHAIN.id);
  return {
    id,
    name: safeString(value?.name) || DEFAULT_CHAIN.name,
    rpcUrl: safeString(value?.rpcUrl),
    blockExplorerUrl: safeString(value?.blockExplorerUrl) || DEFAULT_CHAIN.blockExplorerUrl,
    nativeCurrency: normalizeNativeCurrency(value?.nativeCurrency)
  };
};

const normalizeConfig = (config = {}) => {
  const version = Number(config.version ?? 1) || 1;
  const app = {
    name: safeString(config.app?.name) || 'SQMU Wallet',
    url: safeString(config.app?.url),
    infuraApiKey: safeString(config.app?.infuraApiKey)
  };

  const chainsInput = Array.isArray(config.chains) && config.chains.length
    ? config.chains
    : [DEFAULT_CHAIN];
  const chains = chainsInput.map((chain) => normalizeChain(chain, config.defaultChainId));
  const defaultChainId = Number(config.defaultChainId ?? chains[0]?.id ?? DEFAULT_CHAIN.id);

  const contracts = {
    distributor: safeString(config.contracts?.distributor) || defaultDistributorAddress || DISTRIBUTOR_ADDRESS,
    trade: safeString(config.contracts?.trade) || defaultTradeAddress || TRADE_ADDRESS,
    sqmu: safeString(config.contracts?.sqmu) || defaultSqmuAddress || SQMU_ADDRESS
  };

  const paymentTokens = (Array.isArray(config.paymentTokens) ? config.paymentTokens : DEFAULT_PAYMENT_TOKENS)
    .map((token) => {
      if (typeof token === 'string') {
        return { address: token };
      }
      return {
        address: safeString(token?.address),
        symbol: safeString(token?.symbol),
        decimals: Number.isFinite(Number(token?.decimals)) ? Number(token.decimals) : undefined
      };
    })
    .filter((token) => token.address);

  const properties = (Array.isArray(config.properties) ? config.properties : [])
    .map((property) => ({
      propertyCode: safeString(property?.propertyCode),
      tokenId: Number.isFinite(Number(property?.tokenId)) ? Number(property.tokenId) : null,
      tokenAddress: safeString(property?.tokenAddress)
    }))
    .filter((property) => property.propertyCode);

  const features = {
    buy: config.features?.buy !== false,
    listing: config.features?.listing !== false,
    portfolio: config.features?.portfolio !== false,
    sell: config.features?.sell !== false
  };

  return {
    version,
    app,
    chains,
    defaultChainId,
    contracts,
    paymentTokens,
    properties,
    features
  };
};

const createChainDefinition = (chain) =>
  defineChain({
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: {
      default: {
        http: chain.rpcUrl ? [chain.rpcUrl] : []
      },
      public: {
        http: chain.rpcUrl ? [chain.rpcUrl] : []
      }
    },
    blockExplorers: chain.blockExplorerUrl
      ? {
          default: {
            name: `${chain.name} Explorer`,
            url: chain.blockExplorerUrl
          }
        }
      : undefined
  });

const getWagmiConfig = (appConfig) => {
  const cacheKey = JSON.stringify({
    app: appConfig.app,
    chains: appConfig.chains,
    defaultChainId: appConfig.defaultChainId
  });

  if (wagmiConfigCache.has(cacheKey)) {
    return wagmiConfigCache.get(cacheKey);
  }

  const chains = appConfig.chains.map(createChainDefinition);
  const transports = {};

  chains.forEach((chain, index) => {
    const rpcUrl = appConfig.chains[index]?.rpcUrl;
    transports[chain.id] = rpcUrl ? http(rpcUrl) : http();
  });

  const connectors = [];
  if (appConfig.app.infuraApiKey) {
    connectors.push(
      metaMask({
        infuraAPIKey: appConfig.app.infuraApiKey
      })
    );
  } else {
    connectors.push(metaMask());
  }
  connectors.push(
    injected({
      target: 'injected'
    })
  );

  const config = createConfig({
    chains,
    connectors,
    transports,
    ssr: false
  });

  wagmiConfigCache.set(cacheKey, config);
  return config;
};

const getQueryClient = (cacheKey) => {
  if (!queryClientCache.has(cacheKey)) {
    queryClientCache.set(cacheKey, new QueryClient());
  }
  return queryClientCache.get(cacheKey);
};

const mergeTokenMetadata = (configured, dynamicResults) => {
  const dynamicMap = new Map();
  (dynamicResults ?? []).forEach((result, index) => {
    const tokenIndex = Math.floor(index / 2);
    const token = configured[tokenIndex];
    if (!token?.address) return;
    const current = dynamicMap.get(token.address.toLowerCase()) ?? {
      address: token.address
    };
    if (index % 2 === 0 && result.status === 'success') {
      current.symbol = result.result;
    }
    if (index % 2 === 1 && result.status === 'success') {
      current.decimals = Number(result.result);
    }
    dynamicMap.set(token.address.toLowerCase(), current);
  });

  return configured.map((token) => {
    const dynamic = dynamicMap.get(token.address.toLowerCase()) ?? {};
    return {
      address: token.address,
      symbol: dynamic.symbol || token.symbol || maskAddress(token.address),
      decimals: dynamic.decimals ?? token.decimals ?? 18
    };
  });
};

function Section({ title, help, children, actions }) {
  return (
    <section className="sqmu-section">
      <div className="sqmu-section-header">
        <h3 className="sqmu-section-title">{title}</h3>
        {help ? <p className="sqmu-help">{help}</p> : null}
      </div>
      <div className="sqmu-section-body">{children}</div>
      {actions ? <div className="sqmu-actions">{actions}</div> : null}
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="sqmu-field">
      <span className="sqmu-label">{label}</span>
      {children}
      {hint ? <span className="sqmu-hint">{hint}</span> : null}
    </label>
  );
}

function StatusPill({ tone = 'neutral', children }) {
  return <span className={`sqmu-pill sqmu-pill-${tone}`}>{children}</span>;
}

function WalletPanel({ appConfig, desiredChainId, onEnsureReady, busy }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const availableConnectors = connectors.filter((connector, index) => {
    return connectors.findIndex((candidate) => candidate.id === connector.id) === index;
  });
  const desiredChain = chains.find((chain) => chain.id === desiredChainId);

  return (
    <Section
      title="Wallet"
      help="MetaMask is the primary path, with generic injected EVM wallet support available."
      actions={
        <>
          {isConnected ? (
            <button type="button" className="wp-element-button" onClick={() => disconnect()} disabled={busy}>
              Disconnect
            </button>
          ) : (
            availableConnectors.map((connector) => (
              <button
                type="button"
                key={connector.uid}
                className="wp-element-button"
                onClick={() => connectAsync({ connector })}
                disabled={busy || isPending}
              >
                {isPending && pendingConnector?.uid === connector.uid ? `Connecting ${connector.name}...` : `Connect ${connector.name}`}
              </button>
            ))
          )}
          {isConnected && desiredChain && chainId !== desiredChainId ? (
            <button
              type="button"
              className="wp-element-button"
              onClick={() => onEnsureReady?.(switchChainAsync)}
              disabled={busy || isSwitching}
            >
              {isSwitching ? 'Switching network...' : `Switch to ${desiredChain.name}`}
            </button>
          ) : null}
        </>
      }
    >
      <div className="sqmu-stats">
        <div className="sqmu-stat">
          <span className="sqmu-stat-label">Connection</span>
          <strong>{isConnected ? maskAddress(address) : 'Disconnected'}</strong>
        </div>
        <div className="sqmu-stat">
          <span className="sqmu-stat-label">Chain</span>
          <strong>{chainId ?? 'N/A'}</strong>
        </div>
      </div>
    </Section>
  );
}

function BuyView({ appConfig }) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: appConfig.defaultChainId });
  const propertyOptions = appConfig.properties;
  const [propertyCode, setPropertyCode] = useState(appConfig.propertyCode || propertyOptions[0]?.propertyCode || '');
  const [sqmuAmount, setSqmuAmount] = useState('1.00');
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [agentCode, setAgentCode] = useState('');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);
  const selectedPropertyCode = propertyCode || propertyOptions[0]?.propertyCode || '';

  const { data: propertyInfo } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getPropertyInfo',
    args: [selectedPropertyCode],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor && selectedPropertyCode)
    }
  });

  const { data: availableSqmu } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getAvailable',
    args: [selectedPropertyCode],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor && selectedPropertyCode)
    }
  });

  const { data: contractPaymentTokens } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getPaymentTokens',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor)
    }
  });

  const paymentTokenCandidates = useMemo(() => {
    const configured = appConfig.paymentTokens.map((token) => token.address.toLowerCase());
    const merged = [...appConfig.paymentTokens];
    (contractPaymentTokens ?? []).forEach((addressValue) => {
      if (!configured.includes(addressValue.toLowerCase())) {
        merged.push({ address: addressValue });
      }
    });
    return merged;
  }, [appConfig.paymentTokens, contractPaymentTokens]);

  const paymentTokenMetadata = useReadContracts({
    contracts: paymentTokenCandidates.flatMap((token) => [
      {
        address: token.address,
        abi: erc20Abi,
        functionName: 'symbol',
        chainId: appConfig.defaultChainId
      },
      {
        address: token.address,
        abi: erc20Abi,
        functionName: 'decimals',
        chainId: appConfig.defaultChainId
      }
    ]),
    query: {
      enabled: paymentTokenCandidates.length > 0
    }
  });

  const paymentTokens = useMemo(
    () => mergeTokenMetadata(paymentTokenCandidates, paymentTokenMetadata.data),
    [paymentTokenCandidates, paymentTokenMetadata.data]
  );

  useEffect(() => {
    if (!paymentTokenAddress && paymentTokens[0]?.address) {
      setPaymentTokenAddress(paymentTokens[0].address);
    }
  }, [paymentTokenAddress, paymentTokens]);

  const selectedPaymentToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  );
  const sqmuUnits = parseSqmuUnits(sqmuAmount);
  const paymentQuote = selectedPaymentToken && propertyInfo && sqmuUnits !== null
    ? calculateTokenAmount(propertyInfo.priceUSD, sqmuUnits, selectedPaymentToken.decimals)
    : null;

  const ensureReady = async () => {
    if (!isConnected || !walletClient || !address) {
      throw new Error('Connect a wallet before submitting a purchase.');
    }
    if (chainId !== appConfig.defaultChainId) {
      if (!switchChainAsync) {
        throw new Error('Switch to the configured chain in your wallet.');
      }
      await switchChainAsync({ chainId: appConfig.defaultChainId });
    }
  };

  const submitPurchase = async () => {
    if (!selectedPropertyCode || !selectedPaymentToken || !propertyInfo || sqmuUnits === null) {
      setStatus('Select a property, payment token, and valid SQMU amount.');
      return;
    }
    if (!paymentQuote || paymentQuote <= 0n) {
      setStatus('Unable to calculate the payment quote.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();

      const allowance = await publicClient.readContract({
        address: selectedPaymentToken.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, appConfig.contracts.distributor]
      });

      if (allowance < paymentQuote) {
        setStatus(`Approving ${selectedPaymentToken.symbol}...`);
        const approvalHash = await walletClient.writeContract({
          address: selectedPaymentToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [appConfig.contracts.distributor, paymentQuote],
          account: address,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setStatus('Submitting purchase transaction...');
      const purchaseHash = await walletClient.writeContract({
        address: appConfig.contracts.distributor,
        abi: distributorAbi,
        functionName: 'buySQMU',
        args: [selectedPropertyCode, sqmuUnits, selectedPaymentToken.address, agentCode],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });
      setStatus(`Purchase confirmed: ${purchaseHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} onEnsureReady={async (switchChain) => switchChain?.({ chainId: appConfig.defaultChainId })} />
      <Section
        title="Distributor Purchase"
        help="Reads property data directly from the Atomic SQMU Distributor and performs approvals and purchase writes from the connected wallet."
        actions={
          <button type="button" className="wp-element-button" onClick={submitPurchase} disabled={busy}>
            {busy ? 'Submitting...' : 'Buy SQMU'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Property">
            {propertyOptions.length ? (
              <select value={selectedPropertyCode} onChange={(event) => setPropertyCode(event.target.value)}>
                {propertyOptions.map((property) => (
                  <option key={property.propertyCode} value={property.propertyCode}>
                    {property.propertyCode}
                  </option>
                ))}
              </select>
            ) : (
              <input value={propertyCode} onChange={(event) => setPropertyCode(event.target.value)} placeholder="Property code" />
            )}
          </Field>
          <Field label="SQMU Amount">
            <input value={sqmuAmount} onChange={(event) => setSqmuAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Payment Token">
            <select value={paymentTokenAddress} onChange={(event) => setPaymentTokenAddress(event.target.value)}>
              {paymentTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agent Code" hint="Optional">
            <input value={agentCode} onChange={(event) => setAgentCode(event.target.value)} placeholder="Agent code" />
          </Field>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Property</span>
            <strong>{propertyInfo?.name || selectedPropertyCode || 'N/A'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Available</span>
            <strong>{availableSqmu !== undefined ? formatSqmuUnits(availableSqmu) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Unit Price</span>
            <strong>{propertyInfo ? formatUsd18(propertyInfo.priceUSD) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Quote</span>
            <strong>
              {selectedPaymentToken && paymentQuote !== null
                ? `${formatTokenAmount(paymentQuote, selectedPaymentToken.decimals)} ${selectedPaymentToken.symbol}`
                : '—'}
            </strong>
          </div>
        </div>
        <p className="sqmu-status-line">{status}</p>
      </Section>
    </div>
  );
}

function ListingsView({ appConfig }) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: appConfig.defaultChainId });
  const [selectedListingId, setSelectedListingId] = useState('');
  const [buyAmount, setBuyAmount] = useState('1.00');
  const [sellPropertyCode, setSellPropertyCode] = useState(appConfig.propertyCode || appConfig.properties[0]?.propertyCode || '');
  const [sellAmount, setSellAmount] = useState('1.00');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: listings } = useReadContract({
    address: appConfig.contracts.trade,
    abi: tradeAbi,
    functionName: 'getActiveListings',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.trade)
    }
  });

  const { data: contractPaymentTokens } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getPaymentTokens',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor)
    }
  });

  const listingPaymentTokenCandidates = useMemo(() => {
    const configured = appConfig.paymentTokens.map((token) => token.address.toLowerCase());
    const merged = [...appConfig.paymentTokens];
    (contractPaymentTokens ?? []).forEach((addressValue) => {
      if (!configured.includes(addressValue.toLowerCase())) {
        merged.push({ address: addressValue });
      }
    });
    return merged;
  }, [appConfig.paymentTokens, contractPaymentTokens]);

  const paymentTokenMetadata = useReadContracts({
    contracts: listingPaymentTokenCandidates.flatMap((token) => [
      {
        address: token.address,
        abi: erc20Abi,
        functionName: 'symbol',
        chainId: appConfig.defaultChainId
      },
      {
        address: token.address,
        abi: erc20Abi,
        functionName: 'decimals',
        chainId: appConfig.defaultChainId
      }
    ]),
    query: {
      enabled: listingPaymentTokenCandidates.length > 0
    }
  });

  const paymentTokens = useMemo(
    () => mergeTokenMetadata(listingPaymentTokenCandidates, paymentTokenMetadata.data),
    [listingPaymentTokenCandidates, paymentTokenMetadata.data]
  );
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(paymentTokens[0]?.address ?? '');

  useEffect(() => {
    if (!paymentTokenAddress && paymentTokens[0]?.address) {
      setPaymentTokenAddress(paymentTokens[0].address);
    }
  }, [paymentTokenAddress, paymentTokens]);

  const listingRecords = listings ?? [];
  const selectedListing = listingRecords.find((listing) => String(listing.listingId) === selectedListingId) ?? listingRecords[0] ?? null;

  useEffect(() => {
    if (!selectedListingId && listingRecords[0]?.listingId !== undefined) {
      setSelectedListingId(String(listingRecords[0].listingId));
    }
  }, [selectedListingId, listingRecords]);

  const listingPropertyCodes = useMemo(() => {
    const codes = new Set();
    listingRecords.forEach((listing) => {
      if (listing.propertyCode) codes.add(listing.propertyCode);
    });
    return [...codes];
  }, [listingRecords]);

  const listingPropertyReads = useReadContracts({
    contracts: listingPropertyCodes.map((propertyCode) => ({
      address: appConfig.contracts.distributor,
      abi: distributorAbi,
      functionName: 'getPropertyInfo',
      args: [propertyCode],
      chainId: appConfig.defaultChainId
    })),
    query: {
      enabled: Boolean(appConfig.contracts.distributor && listingPropertyCodes.length)
    }
  });

  const propertyInfoMap = useMemo(() => {
    const map = new Map();
    listingPropertyCodes.forEach((propertyCode, index) => {
      const result = listingPropertyReads.data?.[index];
      if (result?.status === 'success') {
        map.set(propertyCode, result.result);
      }
    });
    return map;
  }, [listingPropertyCodes, listingPropertyReads.data]);

  const selectedPaymentToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  );
  const buyAmountUnits = parseSqmuUnits(buyAmount);
  const listingQuote = selectedListing && selectedPaymentToken && buyAmountUnits !== null
    ? calculateTokenAmount(propertyInfoMap.get(selectedListing.propertyCode)?.priceUSD ?? 0n, buyAmountUnits, selectedPaymentToken.decimals)
    : null;

  const selectedCreateProperty = appConfig.properties.find((property) => property.propertyCode === sellPropertyCode) ?? appConfig.properties[0] ?? null;
  const sellAmountUnits = parseSqmuUnits(sellAmount);

  const ensureReady = async () => {
    if (!isConnected || !walletClient || !address) {
      throw new Error('Connect a wallet before submitting a trade action.');
    }
    if (chainId !== appConfig.defaultChainId) {
      if (!switchChainAsync) {
        throw new Error('Switch to the configured chain in your wallet.');
      }
      await switchChainAsync({ chainId: appConfig.defaultChainId });
    }
  };

  const buyListing = async () => {
    if (!selectedListing || !selectedPaymentToken || buyAmountUnits === null || !listingQuote) {
      setStatus('Select a listing, payment token, and valid SQMU amount.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      const allowance = await publicClient.readContract({
        address: selectedPaymentToken.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, appConfig.contracts.trade]
      });

      if (allowance < listingQuote) {
        setStatus(`Approving ${selectedPaymentToken.symbol} for marketplace purchase...`);
        const approvalHash = await walletClient.writeContract({
          address: selectedPaymentToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [appConfig.contracts.trade, listingQuote],
          account: address,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setStatus('Submitting marketplace purchase...');
      const purchaseHash = await walletClient.writeContract({
        address: appConfig.contracts.trade,
        abi: tradeAbi,
        functionName: 'buy',
        args: [selectedListing.listingId, buyAmountUnits, selectedPaymentToken.address],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });
      setStatus(`Listing purchase confirmed: ${purchaseHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Listing purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  const createListing = async () => {
    if (!selectedCreateProperty || sellAmountUnits === null) {
      setStatus('Select a property and valid SQMU amount to list.');
      return;
    }

    const propertyInfo = propertyInfoMap.get(selectedCreateProperty.propertyCode);
    const tokenAddress = selectedCreateProperty.tokenAddress || propertyInfo?.tokenAddress || appConfig.contracts.sqmu;
    const tokenId = selectedCreateProperty.tokenId ?? Number(propertyInfo?.tokenId ?? 0);

    if (!tokenAddress || !tokenId) {
      setStatus('The selected property is missing token metadata.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();

      const isApproved = await publicClient.readContract({
        address: tokenAddress,
        abi: sqmuAbi,
        functionName: 'isApprovedForAll',
        args: [address, appConfig.contracts.trade]
      });

      if (!isApproved) {
        setStatus('Approving SQMU transfers for the marketplace...');
        const approvalHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: sqmuAbi,
          functionName: 'setApprovalForAll',
          args: [appConfig.contracts.trade, true],
          account: address,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setStatus('Creating listing...');
      const listingHash = await walletClient.writeContract({
        address: appConfig.contracts.trade,
        abi: tradeAbi,
        functionName: 'listToken',
        args: [selectedCreateProperty.propertyCode, tokenAddress, BigInt(tokenId), sellAmountUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: listingHash });
      setStatus(`Listing created: ${listingHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Listing creation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} onEnsureReady={async (switchChain) => switchChain?.({ chainId: appConfig.defaultChainId })} />
      <Section title="Active Listings" help="Active SQMU marketplace listings are loaded directly from the trade contract.">
        {listingRecords.length ? (
          <div className="sqmu-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Property</th>
                  <th>Seller</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {listingRecords.map((listing) => (
                  <tr key={String(listing.listingId)} className={selectedListing && selectedListing.listingId === listing.listingId ? 'is-selected' : ''}>
                    <td>
                      <button type="button" className="sqmu-link-button" onClick={() => setSelectedListingId(String(listing.listingId))}>
                        #{String(listing.listingId)}
                      </button>
                    </td>
                    <td>{listing.propertyCode}</td>
                    <td>{maskAddress(listing.seller)}</td>
                    <td>{formatSqmuUnits(listing.amountListed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sqmu-help">No active listings are currently available.</p>
        )}
      </Section>
      <Section
        title="Buy From Listing"
        actions={
          <button type="button" className="wp-element-button" onClick={buyListing} disabled={busy || !selectedListing}>
            {busy ? 'Submitting...' : 'Buy From Listing'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Listing">
            <select value={selectedListingId} onChange={(event) => setSelectedListingId(event.target.value)}>
              {listingRecords.map((listing) => (
                <option key={String(listing.listingId)} value={String(listing.listingId)}>
                  #{String(listing.listingId)} - {listing.propertyCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SQMU Amount">
            <input value={buyAmount} onChange={(event) => setBuyAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Payment Token">
            <select value={paymentTokenAddress} onChange={(event) => setPaymentTokenAddress(event.target.value)}>
              {paymentTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Selected Listing</span>
            <strong>{selectedListing ? `#${String(selectedListing.listingId)}` : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Estimated Quote</span>
            <strong>
              {selectedPaymentToken && listingQuote !== null
                ? `${formatTokenAmount(listingQuote, selectedPaymentToken.decimals)} ${selectedPaymentToken.symbol}`
                : '—'}
            </strong>
          </div>
        </div>
      </Section>
      <Section
        title="Create Listing"
        help="Create a marketplace listing from the connected wallet. This uses SQMU ERC-1155 approval and trade contract writes."
        actions={
          <button type="button" className="wp-element-button" onClick={createListing} disabled={busy || !appConfig.features.sell}>
            {busy ? 'Submitting...' : 'Create Listing'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Property">
            <select value={sellPropertyCode} onChange={(event) => setSellPropertyCode(event.target.value)}>
              {appConfig.properties.map((property) => (
                <option key={property.propertyCode} value={property.propertyCode}>
                  {property.propertyCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SQMU Amount">
            <input value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </Section>
      <p className="sqmu-status-line">{status}</p>
    </div>
  );
}

function PortfolioView({ appConfig }) {
  const { address, isConnected } = useAccount();
  const properties = appConfig.properties;
  const { data: ownedBalances } = useReadContract({
    address: appConfig.contracts.sqmu,
    abi: sqmuAbi,
    functionName: 'balanceOfBatch',
    args: [properties.map(() => address), properties.map((property) => BigInt(property.tokenId ?? 0))],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(isConnected && address && properties.length && appConfig.contracts.sqmu)
    }
  });

  const propertyInfoReads = useReadContracts({
    contracts: properties.map((property) => ({
      address: appConfig.contracts.distributor,
      abi: distributorAbi,
      functionName: 'getPropertyInfo',
      args: [property.propertyCode],
      chainId: appConfig.defaultChainId
    })),
    query: {
      enabled: Boolean(appConfig.contracts.distributor && properties.length)
    }
  });

  const { data: activeListings } = useReadContract({
    address: appConfig.contracts.trade,
    abi: tradeAbi,
    functionName: 'getActiveListings',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.trade)
    }
  });

  const portfolioRows = useMemo(() => {
    return properties.map((property, index) => {
      const info = propertyInfoReads.data?.[index]?.status === 'success'
        ? propertyInfoReads.data[index].result
        : null;
      const balance = ownedBalances?.[index] ?? 0n;
      const totalValueUsd18 = info ? (toBigInt(info.priceUSD) * toBigInt(balance)) / 100n : 0n;
      return {
        propertyCode: property.propertyCode,
        tokenId: property.tokenId,
        balance,
        info,
        totalValueUsd18
      };
    });
  }, [properties, propertyInfoReads.data, ownedBalances]);

  const personalListings = (activeListings ?? []).filter(
    (listing) => address && listing.seller.toLowerCase() === address.toLowerCase()
  );

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={false} onEnsureReady={async (switchChain) => switchChain?.({ chainId: appConfig.defaultChainId })} />
      <Section title="Portfolio Holdings" help="Portfolio balances are resolved from the SQMU ERC-1155 contract for the configured property catalog.">
        {isConnected ? (
          <div className="sqmu-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Token ID</th>
                  <th>Balance</th>
                  <th>Unit Price</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.map((row) => (
                  <tr key={row.propertyCode}>
                    <td>{row.propertyCode}</td>
                    <td>{row.tokenId ?? '—'}</td>
                    <td>{formatSqmuUnits(row.balance)}</td>
                    <td>{row.info ? formatUsd18(row.info.priceUSD) : '—'}</td>
                    <td>{formatUsd18(row.totalValueUsd18)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sqmu-help">Connect a wallet to load on-chain holdings.</p>
        )}
      </Section>
      <Section title="Your Active Listings" help="Marketplace listings are filtered to the connected wallet.">
        {isConnected ? (
          personalListings.length ? (
            <div className="sqmu-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Property</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {personalListings.map((listing) => (
                    <tr key={String(listing.listingId)}>
                      <td>#{String(listing.listingId)}</td>
                      <td>{listing.propertyCode}</td>
                      <td>{formatSqmuUnits(listing.amountListed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sqmu-help">No active listings for the connected wallet.</p>
          )
        ) : (
          <p className="sqmu-help">Connect a wallet to load your listings.</p>
        )}
      </Section>
    </div>
  );
}

function ConfigError({ issues }) {
  return (
    <div className="sqmu-card sqmu-card-error">
      <h2 className="sqmu-title">SQMU App Configuration Error</h2>
      <ul className="sqmu-error-list">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function App({ mountConfig }) {
  const appConfig = normalizeConfig(mountConfig.config);
  const issues = [...(mountConfig.errors ?? [])];
  if (!appConfig.chains.length) {
    issues.push('At least one chain configuration is required.');
  }
  if (!appConfig.chains.some((chain) => chain.id === appConfig.defaultChainId)) {
    issues.push('defaultChainId must match one of the configured chains.');
  }
  if (!appConfig.contracts.distributor) {
    issues.push('contracts.distributor is required.');
  }
  if (!appConfig.contracts.trade) {
    issues.push('contracts.trade is required.');
  }
  if (!appConfig.contracts.sqmu) {
    issues.push('contracts.sqmu is required.');
  }
  if (!appConfig.chains.every((chain) => chain.rpcUrl)) {
    issues.push('Each configured chain must include an rpcUrl for browser-side reads.');
  }

  if (issues.length) {
    return <ConfigError issues={issues} />;
  }

  const view = mountConfig.view;
  const cacheKey = JSON.stringify({ view, config: appConfig });
  const config = getWagmiConfig(appConfig);
  const queryClient = getQueryClient(cacheKey);

  let content = null;
  if (view === 'listing') {
    content = <ListingsView appConfig={appConfig} />;
  } else if (view === 'portfolio') {
    content = <PortfolioView appConfig={appConfig} />;
  } else {
    content = <BuyView appConfig={appConfig} />;
  }

  return (
    <WagmiProvider config={config} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <div className="sqmu-card">
          <div className="sqmu-header">
            <div>
              <h2 className="sqmu-title">{VIEW_TITLES[view] ?? VIEW_TITLES.buy}</h2>
              <p className="sqmu-help">
                {appConfig.app.name} · Chain {appConfig.defaultChainId} · Config v{appConfig.version}
              </p>
            </div>
            <StatusPill tone="neutral">React + Wagmi</StatusPill>
          </div>
          {content}
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const mergeMountConfig = (payload, mount) => {
  const mountId = mount.id;
  const mountConfig = mountId ? payload.mounts?.[mountId] ?? {} : {};
  return {
    view: mountConfig.view || mount.dataset.sqmuView || 'buy',
    errors: Array.isArray(mountConfig.errors) ? mountConfig.errors : [],
    config: {
      ...(payload.global ?? {}),
      ...(mountConfig.config ?? {})
    }
  };
};

export function initSQMU(payload = {}) {
  const mounts = document.querySelectorAll('[data-sqmu-app]');
  mounts.forEach((mount) => {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <App mountConfig={mergeMountConfig(payload, mount)} />
      </StrictMode>
    );
  });
}
