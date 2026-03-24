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
import { defineChain, formatUnits, isAddress, parseUnits } from 'viem';
import { defaultCrowdfundAddress, crowdfundAbi } from './contracts/crowdfund.js';
import { defaultDistributorAddress, distributorAbi } from './contracts/atomicDistributor.js';
import { defaultEscrowAddress, escrowAbi } from './contracts/escrow.js';
import { defaultEscrowFactoryAddress, escrowFactoryAbi } from './contracts/escrowFactory.js';
import {
  CROWDFUND_ADDRESS,
  DEFAULT_CHAIN,
  DEFAULT_PAYMENT_TOKENS,
  DISTRIBUTOR_ADDRESS,
  ESCROW_FACTORY_ADDRESS,
  RENT_ADDRESS,
  RENT_DISTRIBUTION_ADDRESS,
  SQMU_ADDRESS,
  TRADE_ADDRESS
} from './config.js';
import { defaultRentAddress, rentAbi } from './contracts/rent.js';
import { defaultRentDistributionAddress, rentDistributionAbi } from './contracts/rentDistribution.js';
import { defaultSqmuAddress, sqmuAbi } from './contracts/sqmu.js';
import { defaultTradeAddress, tradeAbi } from './contracts/trade.js';

const SQMU_DECIMALS = 2n;
const USD_DECIMALS = 18n;
const GOVERNANCE_TOKEN_ID = 0n;
const ESCROW_STAGES = [
  { value: 0, label: 'EOI' },
  { value: 1, label: 'Deposit' },
  { value: 2, label: 'Final' }
];
const ESCROW_STATE_LABELS = ['Created', 'Active', 'Completed', 'Cancelled', 'Expired'];
const ESCROW_SETTLEMENT_LABELS = ['Unsettled', 'Released', 'Refunded'];
const ESCROW_ACTION_LABELS = ['Release', 'Refund'];
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
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
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
  portfolio: 'SQMU Portfolio & Market',
  crowdfund: 'Governance Crowdfund',
  rent: 'Property Rent',
  rent_distribution: 'Rent Distribution',
  escrow: 'Escrow Workspace',
  admin_ops: 'SQMU Contract Operations'
};

const maskAddress = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not connected';

const safeString = (value) => (typeof value === 'string' ? value.trim() : '');

const toBigInt = (value, fallback = 0n) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return fallback;
};

const tupleValue = (value, key, index, fallback = null) => {
  if (!value) return fallback;
  if (value[key] !== undefined) return value[key];
  if (value[index] !== undefined) return value[index];
  return fallback;
};

const parseSqmuUnits = (value) => {
  const trimmed = safeString(value);
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const parseIntegerUnits = (value) => {
  const trimmed = safeString(value);
  if (!/^\d+$/.test(trimmed)) return null;
  return BigInt(trimmed);
};

const parseTokenUnits = (value, decimals) => {
  const trimmed = safeString(value);
  if (!trimmed) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch (error) {
    return null;
  }
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

const isBytes32String = (value) => /^0x[a-fA-F0-9]{64}$/.test(safeString(value));

const formatDateTime = (value) => {
  const timestamp = Number(value ?? 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  return new Date(timestamp * 1000).toLocaleString();
};

const futureDateTimeLocal = (days = 30) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const datetimeLocalToUnix = (value) => {
  const trimmed = safeString(value);
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return Math.floor(timestamp / 1000);
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
    sqmu: safeString(config.contracts?.sqmu) || defaultSqmuAddress || SQMU_ADDRESS,
    crowdfund: safeString(config.contracts?.crowdfund) || defaultCrowdfundAddress || CROWDFUND_ADDRESS,
    rent: safeString(config.contracts?.rent) || defaultRentAddress || RENT_ADDRESS,
    rentDistribution: safeString(config.contracts?.rentDistribution) || defaultRentDistributionAddress || RENT_DISTRIBUTION_ADDRESS,
    escrowFactory: safeString(config.contracts?.escrowFactory) || defaultEscrowFactoryAddress || ESCROW_FACTORY_ADDRESS
  };

  const paymentTokens = (Array.isArray(config.paymentTokens) ? config.paymentTokens : DEFAULT_PAYMENT_TOKENS)
    .map((token) => ({
      address: safeString(token?.address),
      symbol: safeString(token?.symbol),
      decimals: Number.isFinite(Number(token?.decimals)) ? Number(token.decimals) : undefined
    }))
    .filter((token) => token.address);

  const properties = (Array.isArray(config.properties) ? config.properties : [])
    .map((property) => ({
      propertyCode: safeString(property?.propertyCode),
      tokenId: Number.isFinite(Number(property?.tokenId)) ? Number(property.tokenId) : null,
      tokenAddress: safeString(property?.tokenAddress),
      propertyId: Number.isFinite(Number(property?.propertyId)) ? Number(property.propertyId) : null,
      propertyRef: isBytes32String(property?.propertyRef) ? property.propertyRef : '',
      postId: Number.isFinite(Number(property?.postId)) ? Number(property.postId) : null,
      postTitle: safeString(property?.postTitle)
    }))
    .filter((property) => property.propertyCode);

  const features = {
    buy: config.features?.buy !== false,
    portfolio: config.features?.portfolio !== false,
    sell: config.features?.sell !== false
  };

  return {
    version,
    context: safeString(config.context) || 'public',
    app,
    currentUser: {
      canManageOptions: Boolean(config.currentUser?.canManageOptions)
    },
    chains,
    defaultChainId,
    contracts,
    paymentTokens,
    properties,
    features,
    propertyCode: safeString(config.propertyCode),
    escrowAddress: safeString(config.escrowAddress)
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
    connectors.push(metaMask({ infuraAPIKey: appConfig.app.infuraApiKey }));
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

function useResolvedPaymentTokens(appConfig, extraTokenAddresses = []) {
  const candidates = useMemo(() => {
    const merged = [...appConfig.paymentTokens];
    const seen = new Set(merged.map((token) => token.address.toLowerCase()));
    extraTokenAddresses.forEach((address) => {
      const normalized = safeString(address);
      if (!normalized) return;
      const lower = normalized.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      merged.push({ address: normalized });
    });
    return merged;
  }, [appConfig.paymentTokens, extraTokenAddresses]);

  const paymentTokenMetadata = useReadContracts({
    contracts: candidates.flatMap((token) => [
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
      enabled: candidates.length > 0
    }
  });

  return useMemo(
    () => mergeTokenMetadata(candidates, paymentTokenMetadata.data),
    [candidates, paymentTokenMetadata.data]
  );
}

function usePropertyInfoMap(appConfig, propertyCodes) {
  const propertyReads = useReadContracts({
    contracts: propertyCodes.map((propertyCode) => ({
      address: appConfig.contracts.distributor,
      abi: distributorAbi,
      functionName: 'getPropertyInfo',
      args: [propertyCode],
      chainId: appConfig.defaultChainId
    })),
    query: {
      enabled: Boolean(appConfig.contracts.distributor && propertyCodes.length)
    }
  });

  return useMemo(() => {
    const map = new Map();
    propertyCodes.forEach((propertyCode, index) => {
      const result = propertyReads.data?.[index];
      if (result?.status === 'success') {
        map.set(propertyCode, result.result);
      }
    });
    return map;
  }, [propertyCodes, propertyReads.data]);
}

function useAppWallet(appConfig) {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: appConfig.defaultChainId });

  const ensureReady = async () => {
    if (!isConnected || !walletClient || !address) {
      throw new Error('Connect a wallet before submitting this action.');
    }
    if (chainId !== appConfig.defaultChainId) {
      if (!switchChainAsync) {
        throw new Error('Switch to the configured chain in your wallet.');
      }
      await switchChainAsync({ chainId: appConfig.defaultChainId });
    }
  };

  return {
    address,
    isConnected,
    chainId,
    walletClient,
    publicClient,
    ensureReady
  };
}

async function approveErc20IfNeeded({
  publicClient,
  walletClient,
  token,
  owner,
  spender,
  amount,
  setStatus
}) {
  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender]
  });

  if (allowance >= amount) {
    return null;
  }

  setStatus?.(`Approving ${token.symbol}...`);
  const approvalHash = await walletClient.writeContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
    account: owner,
    chain: walletClient.chain
  });
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  return approvalHash;
}

async function approveErc1155IfNeeded({
  publicClient,
  walletClient,
  tokenAddress,
  owner,
  operator,
  setStatus
}) {
  const isApproved = await publicClient.readContract({
    address: tokenAddress,
    abi: sqmuAbi,
    functionName: 'isApprovedForAll',
    args: [owner, operator]
  });

  if (isApproved) {
    return null;
  }

  setStatus?.('Approving SQMU transfers...');
  const approvalHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: sqmuAbi,
    functionName: 'setApprovalForAll',
    args: [operator, true],
    account: owner,
    chain: walletClient.chain
  });
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  return approvalHash;
}

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

function WalletPanel({ appConfig, desiredChainId, busy }) {
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
              onClick={() => switchChainAsync?.({ chainId: desiredChainId })}
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
        <div className="sqmu-stat">
          <span className="sqmu-stat-label">App Context</span>
          <strong>{appConfig.context === 'admin' ? 'wp-admin' : 'Public page'}</strong>
        </div>
      </div>
    </Section>
  );
}

function BuyView({ appConfig }) {
  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const propertyOptions = appConfig.properties.filter((property) => property.propertyCode);
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

  const { data: distributorPaymentTokens } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getPaymentTokens',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor)
    }
  });

  const paymentTokens = useResolvedPaymentTokens(appConfig, distributorPaymentTokens ?? []);

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
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: selectedPaymentToken,
        owner: address,
        spender: appConfig.contracts.distributor,
        amount: paymentQuote,
        setStatus
      });

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
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} />
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
                    {property.postTitle ? `${property.postTitle} (${property.propertyCode})` : property.propertyCode}
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

function PortfolioView({ appConfig }) {
  const { address, isConnected, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const properties = appConfig.properties.filter((property) => property.tokenId !== null);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [buyAmount, setBuyAmount] = useState('1.00');
  const [sellPropertyCode, setSellPropertyCode] = useState(appConfig.propertyCode || properties[0]?.propertyCode || '');
  const [sellAmount, setSellAmount] = useState('1.00');
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const propertyInfoMap = usePropertyInfoMap(appConfig, properties.map((property) => property.propertyCode));

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

  const { data: activeListings } = useReadContract({
    address: appConfig.contracts.trade,
    abi: tradeAbi,
    functionName: 'getActiveListings',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.trade)
    }
  });

  const { data: distributorPaymentTokens } = useReadContract({
    address: appConfig.contracts.distributor,
    abi: distributorAbi,
    functionName: 'getPaymentTokens',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.distributor)
    }
  });

  const paymentTokens = useResolvedPaymentTokens(appConfig, distributorPaymentTokens ?? []);

  useEffect(() => {
    if (!paymentTokenAddress && paymentTokens[0]?.address) {
      setPaymentTokenAddress(paymentTokens[0].address);
    }
  }, [paymentTokenAddress, paymentTokens]);

  const portfolioRows = useMemo(() => {
    return properties.map((property, index) => {
      const info = propertyInfoMap.get(property.propertyCode) ?? null;
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
  }, [properties, propertyInfoMap, ownedBalances]);

  const listingRecords = activeListings ?? [];
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

  const listingPropertyInfoMap = usePropertyInfoMap(appConfig, listingPropertyCodes);
  const selectedPaymentToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  );
  const buyAmountUnits = parseSqmuUnits(buyAmount);
  const listingQuote = selectedListing && selectedPaymentToken && buyAmountUnits !== null
    ? calculateTokenAmount(listingPropertyInfoMap.get(selectedListing.propertyCode)?.priceUSD ?? 0n, buyAmountUnits, selectedPaymentToken.decimals)
    : null;

  const selectedCreateProperty = properties.find((property) => property.propertyCode === sellPropertyCode) ?? properties[0] ?? null;
  const sellAmountUnits = parseSqmuUnits(sellAmount);
  const personalListings = (activeListings ?? []).filter(
    (listing) => address && listing.seller.toLowerCase() === address.toLowerCase()
  );

  const buyListing = async () => {
    if (!selectedListing || !selectedPaymentToken || buyAmountUnits === null || !listingQuote) {
      setStatus('Select a listing, payment token, and valid SQMU amount.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: selectedPaymentToken,
        owner: address,
        spender: appConfig.contracts.trade,
        amount: listingQuote,
        setStatus
      });

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
      setStatus(`Marketplace purchase confirmed: ${purchaseHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Marketplace purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  const createListing = async () => {
    if (!selectedCreateProperty || sellAmountUnits === null) {
      setStatus('Select a property and valid SQMU amount to list.');
      return;
    }

    const tokenAddress = selectedCreateProperty.tokenAddress || appConfig.contracts.sqmu;
    const tokenId = selectedCreateProperty.tokenId;

    if (!tokenAddress || tokenId === null) {
      setStatus('The selected property is missing token metadata.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc1155IfNeeded({
        publicClient,
        walletClient,
        tokenAddress,
        owner: address,
        operator: appConfig.contracts.trade,
        setStatus
      });

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
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} />
      <Section title="Portfolio Holdings" help="Holdings are resolved from the SQMU ERC-1155 contract for the configured property catalog.">
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
                    <td>{row.postTitle ? `${row.postTitle} (${row.propertyCode})` : row.propertyCode}</td>
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
      <Section title="Active Marketplace Listings" help="Browse live listings, buy from existing offers, and use the marketplace from the same portfolio workspace.">
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
        title="List Your Holdings"
        help="Create a marketplace listing from your SQMU holdings in this same portfolio workspace."
        actions={
          <button type="button" className="wp-element-button" onClick={createListing} disabled={busy || !appConfig.features.sell}>
            {busy ? 'Submitting...' : 'Create Listing'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Property">
            <select value={sellPropertyCode} onChange={(event) => setSellPropertyCode(event.target.value)}>
              {properties.map((property) => (
                <option key={property.propertyCode} value={property.propertyCode}>
                  {property.postTitle ? `${property.postTitle} (${property.propertyCode})` : property.propertyCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SQMU Amount">
            <input value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </Section>
      <Section title="Your Active Listings" help="Listings owned by the connected wallet are shown here for quick monitoring.">
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
      <p className="sqmu-status-line">{status}</p>
    </div>
  );
}

function CrowdfundView({ appConfig }) {
  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const paymentTokens = useResolvedPaymentTokens(appConfig);
  const [governanceAmount, setGovernanceAmount] = useState('1');
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: priceUsd } = useReadContract({
    address: appConfig.contracts.crowdfund,
    abi: crowdfundAbi,
    functionName: 'priceUSD',
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.crowdfund)
    }
  });

  const { data: governanceSupply } = useReadContract({
    address: appConfig.contracts.sqmu,
    abi: sqmuAbi,
    functionName: 'balanceOf',
    args: [appConfig.contracts.crowdfund, GOVERNANCE_TOKEN_ID],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.sqmu && appConfig.contracts.crowdfund)
    }
  });

  useEffect(() => {
    if (!paymentTokenAddress && paymentTokens[0]?.address) {
      setPaymentTokenAddress(paymentTokens[0].address);
    }
  }, [paymentTokenAddress, paymentTokens]);

  const selectedPaymentToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  );
  const governanceUnits = parseIntegerUnits(governanceAmount);
  const paymentQuote = selectedPaymentToken && governanceUnits !== null && priceUsd !== undefined
    ? (toBigInt(priceUsd) * governanceUnits * (10n ** BigInt(selectedPaymentToken.decimals))) / (10n ** USD_DECIMALS)
    : null;

  const submitCrowdfundPurchase = async () => {
    if (!selectedPaymentToken || governanceUnits === null || governanceUnits <= 0n) {
      setStatus('Enter a valid governance token amount and payment token.');
      return;
    }
    if (!paymentQuote || paymentQuote <= 0n) {
      setStatus('Unable to calculate the crowdfund quote.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: selectedPaymentToken,
        owner: address,
        spender: appConfig.contracts.crowdfund,
        amount: paymentQuote,
        setStatus
      });

      setStatus('Submitting governance purchase...');
      const purchaseHash = await walletClient.writeContract({
        address: appConfig.contracts.crowdfund,
        abi: crowdfundAbi,
        functionName: 'buy',
        args: [selectedPaymentToken.address, governanceUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });
      setStatus(`Crowdfund purchase confirmed: ${purchaseHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Crowdfund purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} />
      <Section
        title="Governance Purchase"
        help="Buy governance tokens from the SQMU Crowdfund contract using configured stablecoins."
        actions={
          <button type="button" className="wp-element-button" onClick={submitCrowdfundPurchase} disabled={busy}>
            {busy ? 'Submitting...' : 'Buy Governance'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Governance Amount">
            <input value={governanceAmount} onChange={(event) => setGovernanceAmount(event.target.value)} inputMode="numeric" />
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
            <span className="sqmu-stat-label">Price Per Token</span>
            <strong>{priceUsd !== undefined ? formatUsd18(priceUsd) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Available Supply</span>
            <strong>{governanceSupply !== undefined ? String(governanceSupply) : '—'}</strong>
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

function RentView({ appConfig }) {
  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const properties = appConfig.properties.filter((property) => property.propertyId !== null);
  const [propertyCode, setPropertyCode] = useState(appConfig.propertyCode || properties[0]?.propertyCode || '');
  const [depositTokenAddress, setDepositTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [depositAmount, setDepositAmount] = useState('');
  const [rentTokenAddress, setRentTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [rentAmount, setRentAmount] = useState('');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const selectedProperty = properties.find((property) => property.propertyCode === propertyCode) ?? properties[0] ?? null;
  const propertyId = selectedProperty?.propertyId ?? null;
  const acceptedTokenReads = useReadContracts({
    contracts: appConfig.paymentTokens.map((token) => ({
      address: appConfig.contracts.rent,
      abi: rentAbi,
      functionName: 'acceptedTokens',
      args: [token.address],
      chainId: appConfig.defaultChainId
    })),
    query: {
      enabled: Boolean(appConfig.contracts.rent && appConfig.paymentTokens.length)
    }
  });

  const acceptedPaymentTokens = useMemo(() => {
    return appConfig.paymentTokens.filter((token, index) => acceptedTokenReads.data?.[index]?.result);
  }, [appConfig.paymentTokens, acceptedTokenReads.data]);

  useEffect(() => {
    if (acceptedPaymentTokens[0]?.address && !acceptedPaymentTokens.find((token) => token.address === depositTokenAddress)) {
      setDepositTokenAddress(acceptedPaymentTokens[0].address);
    }
    if (acceptedPaymentTokens[0]?.address && !acceptedPaymentTokens.find((token) => token.address === rentTokenAddress)) {
      setRentTokenAddress(acceptedPaymentTokens[0].address);
    }
  }, [acceptedPaymentTokens, depositTokenAddress, rentTokenAddress]);

  const { data: depositDetails } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'getDepositDetails',
    args: [BigInt(propertyId ?? 0)],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.rent && propertyId !== null)
    }
  });

  const { data: rentalInfo } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'rentals',
    args: [BigInt(propertyId ?? 0)],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.rent && propertyId !== null)
    }
  });

  const selectedDepositToken = acceptedPaymentTokens.find((token) => token.address === depositTokenAddress);
  const selectedRentToken = acceptedPaymentTokens.find((token) => token.address === rentTokenAddress);
  const depositTokenUnits = selectedDepositToken ? parseTokenUnits(depositAmount, selectedDepositToken.decimals) : null;
  const rentTokenUnits = selectedRentToken ? parseTokenUnits(rentAmount, selectedRentToken.decimals) : null;

  const payDeposit = async () => {
    if (propertyId === null || !selectedDepositToken || depositTokenUnits === null || depositTokenUnits <= 0n) {
      setStatus('Select a property, accepted token, and valid deposit amount.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: selectedDepositToken,
        owner: address,
        spender: appConfig.contracts.rent,
        amount: depositTokenUnits,
        setStatus
      });

      setStatus('Submitting deposit payment...');
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.rent,
        abi: rentAbi,
        functionName: 'payDeposit',
        args: [BigInt(propertyId), selectedDepositToken.address, depositTokenUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Deposit confirmed: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Deposit payment failed.');
    } finally {
      setBusy(false);
    }
  };

  const collectRent = async () => {
    if (propertyId === null || !selectedRentToken || rentTokenUnits === null || rentTokenUnits <= 0n) {
      setStatus('Select a property, accepted token, and valid rent amount.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: selectedRentToken,
        owner: address,
        spender: appConfig.contracts.rent,
        amount: rentTokenUnits,
        setStatus
      });

      setStatus('Submitting rent payment...');
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.rent,
        abi: rentAbi,
        functionName: 'collectRent',
        args: [BigInt(propertyId), selectedRentToken.address, rentTokenUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Rent payment confirmed: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Rent payment failed.');
    } finally {
      setBusy(false);
    }
  };

  const depositAmountValue = tupleValue(depositDetails, 'amount', 0, 0n);
  const depositTokenValue = tupleValue(depositDetails, 'token', 1, '');
  const depositTenant = tupleValue(depositDetails, 'tenant', 2, '');
  const depositContractBalance = tupleValue(depositDetails, 'contractBalance', 3, 0n);
  const occupied = Boolean(tupleValue(rentalInfo, 'occupied', 2, false));
  const nextRentDue = tupleValue(rentalInfo, 'nextRentDue', 1, 0n);

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={busy} />
      <Section title="Property Rent Status" help="Reads tenant deposit and rental state directly from the SQMU Rent contract.">
        <div className="sqmu-form-grid">
          <Field label="Property">
            <select value={propertyCode} onChange={(event) => setPropertyCode(event.target.value)}>
              {properties.map((property) => (
                <option key={property.propertyCode} value={property.propertyCode}>
                  {property.postTitle ? `${property.postTitle} (${property.propertyCode})` : property.propertyCode}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Property ID</span>
            <strong>{propertyId ?? '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Occupied</span>
            <strong>{occupied ? 'Yes' : 'No'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Tenant</span>
            <strong>{depositTenant ? maskAddress(depositTenant) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Next Rent Due</span>
            <strong>{formatDateTime(nextRentDue)}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Deposit Token</span>
            <strong>{depositTokenValue ? maskAddress(depositTokenValue) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Deposit Amount</span>
            <strong>{depositAmountValue ? depositAmountValue.toString() : '0'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Contract Balance</span>
            <strong>{depositContractBalance ? depositContractBalance.toString() : '0'}</strong>
          </div>
        </div>
      </Section>
      <Section
        title="Pay Deposit"
        actions={
          <button type="button" className="wp-element-button" onClick={payDeposit} disabled={busy || !selectedProperty}>
            {busy ? 'Submitting...' : 'Pay Deposit'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Accepted Token">
            <select value={depositTokenAddress} onChange={(event) => setDepositTokenAddress(event.target.value)}>
              {acceptedPaymentTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deposit Amount">
            <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </Section>
      <Section
        title="Collect Rent"
        help="Rent collection is performed by the tenant within the rent window configured on-chain."
        actions={
          <button type="button" className="wp-element-button" onClick={collectRent} disabled={busy || !selectedProperty}>
            {busy ? 'Submitting...' : 'Pay Rent'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Accepted Token">
            <select value={rentTokenAddress} onChange={(event) => setRentTokenAddress(event.target.value)}>
              {acceptedPaymentTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rent Amount">
            <input value={rentAmount} onChange={(event) => setRentAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </Section>
      <p className="sqmu-status-line">{status}</p>
    </div>
  );
}

function RentDistributionView({ appConfig }) {
  const properties = appConfig.properties.filter((property) => property.propertyId !== null);
  const [propertyCode, setPropertyCode] = useState(appConfig.propertyCode || properties[0]?.propertyCode || '');
  const selectedProperty = properties.find((property) => property.propertyCode === propertyCode) ?? properties[0] ?? null;
  const propertyId = selectedProperty?.propertyId ?? null;

  const balanceReads = useReadContracts({
    contracts: appConfig.paymentTokens.map((token) => ({
      address: appConfig.contracts.rentDistribution,
      abi: rentDistributionAbi,
      functionName: 'rentBalances',
      args: [BigInt(propertyId ?? 0), token.address],
      chainId: appConfig.defaultChainId
    })),
    query: {
      enabled: Boolean(appConfig.contracts.rentDistribution && propertyId !== null && appConfig.paymentTokens.length)
    }
  });

  const balanceRows = useMemo(() => {
    return appConfig.paymentTokens.map((token, index) => ({
      ...token,
      balance: balanceReads.data?.[index]?.result ?? 0n
    }));
  }, [appConfig.paymentTokens, balanceReads.data]);

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={false} />
      <Section title="Distribution Balances" help="This view reads per-property rent balances from the SQMU Rent Distribution contract. Write-capable distribution is deferred in this pass because the current SQMU contract does not enumerate holders.">
        <div className="sqmu-form-grid">
          <Field label="Property">
            <select value={propertyCode} onChange={(event) => setPropertyCode(event.target.value)}>
              {properties.map((property) => (
                <option key={property.propertyCode} value={property.propertyCode}>
                  {property.postTitle ? `${property.postTitle} (${property.propertyCode})` : property.propertyCode}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Property ID</span>
            <strong>{propertyId ?? '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Vault</span>
            <strong>{appConfig.contracts.rentDistribution ? maskAddress(appConfig.contracts.rentDistribution) : '—'}</strong>
          </div>
        </div>
        <div className="sqmu-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((row) => (
                <tr key={row.address}>
                  <td>{row.symbol}</td>
                  <td>{formatTokenAmount(row.balance, row.decimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sqmu-help">Distribution submission is intentionally not exposed until a holder registry exists outside the current SQMU contract surface.</p>
      </Section>
    </div>
  );
}

function ExistingEscrowPanel({ appConfig, escrowAddress }) {
  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const [depositStage, setDepositStage] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [actionStage, setActionStage] = useState(0);
  const [confirmActionId, setConfirmActionId] = useState('1');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: participants } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'getParticipants',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: paymentTokenAddress } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'paymentToken',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: propertyRef } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'propertyRef',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: deadline } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'deadline',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: lifecycleState } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'currentState',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: actionCount } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'actionCount',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const { data: totalHeldBalance } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'totalHeldBalance',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(escrowAddress) }
  });

  const stageReads = useReadContracts({
    contracts: ESCROW_STAGES.map((stage) => ({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: 'getStageDetails',
      args: [stage.value],
      chainId: appConfig.defaultChainId
    })),
    query: { enabled: Boolean(escrowAddress) }
  });

  const actionIds = useMemo(() => {
    const count = Number(actionCount ?? 0n);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [actionCount]);

  const actionReads = useReadContracts({
    contracts: actionIds.map((actionId) => ({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: 'getAction',
      args: [BigInt(actionId)],
      chainId: appConfig.defaultChainId
    })),
    query: { enabled: Boolean(escrowAddress && actionIds.length) }
  });

  const paymentTokens = useResolvedPaymentTokens(appConfig, paymentTokenAddress ? [paymentTokenAddress] : []);
  const managedToken = paymentTokens.find(
    (token) => paymentTokenAddress && token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  ) ?? (paymentTokenAddress ? { address: paymentTokenAddress, symbol: maskAddress(paymentTokenAddress), decimals: 18 } : null);

  const depositUnits = managedToken ? parseTokenUnits(depositAmount, managedToken.decimals) : null;
  const participantBuyer = tupleValue(participants, 'buyer_', 0, '');
  const participantSeller = tupleValue(participants, 'seller_', 1, '');
  const participantAgent = tupleValue(participants, 'agent_', 2, '');

  const stageRows = useMemo(() => {
    return ESCROW_STAGES.map((stage, index) => {
      const result = stageReads.data?.[index]?.result;
      return {
        ...stage,
        targetAmount: tupleValue(result, 'targetAmount', 0, 0n),
        depositedAmount: tupleValue(result, 'depositedAmount', 1, 0n),
        heldAmount: tupleValue(result, 'heldAmount', 2, 0n),
        settlement: Number(tupleValue(result, 'settlement', 3, 0n))
      };
    });
  }, [stageReads.data]);

  const actionRows = useMemo(() => {
    return actionIds.map((actionId, index) => {
      const result = actionReads.data?.[index]?.result;
      return {
        actionId,
        actionType: Number(tupleValue(result, 'actionType', 0, 0n)),
        stage: Number(tupleValue(result, 'stage', 1, 0n)),
        proposer: tupleValue(result, 'proposer', 2, ''),
        confirmationCount: Number(tupleValue(result, 'confirmationCount', 3, 0n)),
        executed: Boolean(tupleValue(result, 'executed', 4, false)),
        buyerConfirmed: Boolean(tupleValue(result, 'buyerConfirmed', 5, false)),
        sellerConfirmed: Boolean(tupleValue(result, 'sellerConfirmed', 6, false)),
        agentConfirmed: Boolean(tupleValue(result, 'agentConfirmed', 7, false))
      };
    });
  }, [actionIds, actionReads.data]);

  const depositFunds = async () => {
    if (!managedToken || depositUnits === null || depositUnits <= 0n) {
      setStatus('Enter a valid deposit amount for the escrow stage.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      await approveErc20IfNeeded({
        publicClient,
        walletClient,
        token: managedToken,
        owner: address,
        spender: escrowAddress,
        amount: depositUnits,
        setStatus
      });

      setStatus('Submitting escrow deposit...');
      const txHash = await walletClient.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: 'deposit',
        args: [depositStage, depositUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Escrow deposit confirmed: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Escrow deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  const proposeEscrowAction = async (actionType) => {
    setBusy(true);
    try {
      await ensureReady();
      setStatus(`Submitting ${actionType === 'release' ? 'release' : 'refund'} proposal...`);
      const txHash = await walletClient.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: actionType === 'release' ? 'proposeRelease' : 'proposeRefund',
        args: [actionStage],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Escrow action proposed: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Escrow action failed.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEscrowAction = async () => {
    const actionId = parseIntegerUnits(confirmActionId);
    if (actionId === null || actionId <= 0n) {
      setStatus('Enter a valid action id to confirm.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      setStatus('Confirming escrow action...');
      const txHash = await walletClient.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: 'confirmAction',
        args: [actionId],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Escrow action confirmed: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Escrow action confirmation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sqmu-stack">
      <Section title="Escrow Overview" help="Loads the existing escrow instance and exposes participant actions directly from the escrow contract.">
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Escrow</span>
            <strong>{maskAddress(escrowAddress)}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">State</span>
            <strong>{ESCROW_STATE_LABELS[Number(lifecycleState ?? 0n)] ?? 'Unknown'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Property Ref</span>
            <strong>{safeString(propertyRef) || '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Deadline</span>
            <strong>{formatDateTime(deadline)}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Payment Token</span>
            <strong>{managedToken ? managedToken.symbol : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Held Balance</span>
            <strong>{managedToken ? `${formatTokenAmount(totalHeldBalance ?? 0n, managedToken.decimals)} ${managedToken.symbol}` : '—'}</strong>
          </div>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Buyer</span>
            <strong>{participantBuyer ? maskAddress(participantBuyer) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Seller</span>
            <strong>{participantSeller ? maskAddress(participantSeller) : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Agent</span>
            <strong>{participantAgent ? maskAddress(participantAgent) : '—'}</strong>
          </div>
        </div>
      </Section>
      <Section title="Escrow Stages" help="Each stage tracks its target amount, funded amount, held balance, and settlement status.">
        <div className="sqmu-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Target</th>
                <th>Deposited</th>
                <th>Held</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((stage) => (
                <tr key={stage.value}>
                  <td>{stage.label}</td>
                  <td>{managedToken ? `${formatTokenAmount(stage.targetAmount, managedToken.decimals)} ${managedToken.symbol}` : stage.targetAmount.toString()}</td>
                  <td>{managedToken ? `${formatTokenAmount(stage.depositedAmount, managedToken.decimals)} ${managedToken.symbol}` : stage.depositedAmount.toString()}</td>
                  <td>{managedToken ? `${formatTokenAmount(stage.heldAmount, managedToken.decimals)} ${managedToken.symbol}` : stage.heldAmount.toString()}</td>
                  <td>{ESCROW_SETTLEMENT_LABELS[stage.settlement] ?? 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section
        title="Deposit Funds"
        actions={
          <button type="button" className="wp-element-button" onClick={depositFunds} disabled={busy || !managedToken}>
            {busy ? 'Submitting...' : 'Deposit Into Escrow'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Stage">
            <select value={depositStage} onChange={(event) => setDepositStage(Number(event.target.value))}>
              {ESCROW_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </Section>
      <Section
        title="Release Or Refund"
        actions={
          <>
            <button type="button" className="wp-element-button" onClick={() => proposeEscrowAction('release')} disabled={busy}>
              {busy ? 'Submitting...' : 'Propose Release'}
            </button>
            <button type="button" className="wp-element-button" onClick={() => proposeEscrowAction('refund')} disabled={busy}>
              {busy ? 'Submitting...' : 'Propose Refund'}
            </button>
          </>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Stage">
            <select value={actionStage} onChange={(event) => setActionStage(Number(event.target.value))}>
              {ESCROW_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>
      <Section
        title="Confirm Action"
        actions={
          <button type="button" className="wp-element-button" onClick={confirmEscrowAction} disabled={busy}>
            {busy ? 'Submitting...' : 'Confirm Escrow Action'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Action ID">
            <input value={confirmActionId} onChange={(event) => setConfirmActionId(event.target.value)} inputMode="numeric" />
          </Field>
        </div>
      </Section>
      <Section title="Action History" help="Action ids can be confirmed by the escrow participants until they execute.">
        {actionRows.length ? (
          <div className="sqmu-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Proposer</th>
                  <th>Confirmations</th>
                  <th>Executed</th>
                </tr>
              </thead>
              <tbody>
                {actionRows.map((row) => (
                  <tr key={row.actionId}>
                    <td>{row.actionId}</td>
                    <td>{ESCROW_ACTION_LABELS[row.actionType] ?? 'Unknown'}</td>
                    <td>{ESCROW_STAGES.find((stage) => stage.value === row.stage)?.label ?? row.stage}</td>
                    <td>{maskAddress(row.proposer)}</td>
                    <td>{row.confirmationCount}</td>
                    <td>{row.executed ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sqmu-help">No escrow actions have been proposed yet.</p>
        )}
      </Section>
      <p className="sqmu-status-line">{status}</p>
    </div>
  );
}

function EscrowCreatePanel({ appConfig }) {
  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const paymentTokens = useResolvedPaymentTokens(appConfig);
  const properties = appConfig.properties;
  const [propertyCode, setPropertyCode] = useState(appConfig.propertyCode || properties[0]?.propertyCode || '');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [agentAddress, setAgentAddress] = useState('');
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [propertyRef, setPropertyRef] = useState('');
  const [deadlineInput, setDeadlineInput] = useState(futureDateTimeLocal(30));
  const [eoiAmount, setEoiAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const selectedProperty = properties.find((property) => property.propertyCode === propertyCode) ?? null;

  useEffect(() => {
    if (address && !buyerAddress) {
      setBuyerAddress(address);
    }
  }, [address, buyerAddress]);

  useEffect(() => {
    if (selectedProperty?.propertyRef) {
      setPropertyRef(selectedProperty.propertyRef);
    }
  }, [selectedProperty?.propertyRef]);

  useEffect(() => {
    if (!paymentTokenAddress && paymentTokens[0]?.address) {
      setPaymentTokenAddress(paymentTokens[0].address);
    }
  }, [paymentTokenAddress, paymentTokens]);

  const selectedPaymentToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === paymentTokenAddress.toLowerCase()
  );

  const eoiUnits = selectedPaymentToken ? parseTokenUnits(eoiAmount, selectedPaymentToken.decimals) : null;
  const depositUnits = selectedPaymentToken ? parseTokenUnits(depositAmount, selectedPaymentToken.decimals) : null;
  const finalUnits = selectedPaymentToken ? parseTokenUnits(finalAmount, selectedPaymentToken.decimals) : null;
  const deadlineTimestamp = datetimeLocalToUnix(deadlineInput);

  const { data: tokenAllowed } = useReadContract({
    address: appConfig.contracts.escrowFactory,
    abi: escrowFactoryAbi,
    functionName: 'allowedTokens',
    args: [paymentTokenAddress || '0x0000000000000000000000000000000000000000'],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.escrowFactory && paymentTokenAddress)
    }
  });

  const { data: relatedEscrows } = useReadContract({
    address: appConfig.contracts.escrowFactory,
    abi: escrowFactoryAbi,
    functionName: 'getEscrowsByProperty',
    args: [propertyRef || '0x0000000000000000000000000000000000000000000000000000000000000000'],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.escrowFactory && isBytes32String(propertyRef))
    }
  });

  const createEscrow = async () => {
    if (!selectedPaymentToken || !isAddress(buyerAddress) || !isAddress(sellerAddress) || !isAddress(agentAddress)) {
      setStatus('Enter valid buyer, seller, agent, and payment token values.');
      return;
    }
    if (!isBytes32String(propertyRef)) {
      setStatus('Enter a valid bytes32 property reference.');
      return;
    }
    if (!deadlineTimestamp || deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      setStatus('Choose a future deadline.');
      return;
    }
    if (eoiUnits === null || depositUnits === null || finalUnits === null || eoiUnits <= 0n || depositUnits <= 0n || finalUnits <= 0n) {
      setStatus('Enter valid EOI, deposit, and final stage amounts.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      setStatus('Creating escrow...');
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.escrowFactory,
        abi: escrowFactoryAbi,
        functionName: 'createEscrow',
        args: [
          buyerAddress,
          sellerAddress,
          agentAddress,
          selectedPaymentToken.address,
          propertyRef,
          BigInt(deadlineTimestamp),
          eoiUnits,
          depositUnits,
          finalUnits
        ],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Escrow created: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Escrow creation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sqmu-stack">
      <Section
        title="Create Escrow"
        help="Create a new escrow through the configured Escrow Factory. If a property post provides `_sqmu_property_ref`, it will prefill the property reference for you."
        actions={
          <button type="button" className="wp-element-button" onClick={createEscrow} disabled={busy}>
            {busy ? 'Submitting...' : 'Create Escrow'}
          </button>
        }
      >
        <div className="sqmu-form-grid">
          <Field label="Property">
            <select value={propertyCode} onChange={(event) => setPropertyCode(event.target.value)}>
              <option value="">No property prefill</option>
              {properties.map((property) => (
                <option key={property.propertyCode} value={property.propertyCode}>
                  {property.postTitle ? `${property.postTitle} (${property.propertyCode})` : property.propertyCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Property Ref">
            <input value={propertyRef} onChange={(event) => setPropertyRef(event.target.value)} placeholder="0x..." />
          </Field>
          <Field label="Buyer Address">
            <input value={buyerAddress} onChange={(event) => setBuyerAddress(event.target.value)} placeholder="0x..." />
          </Field>
          <Field label="Seller Address">
            <input value={sellerAddress} onChange={(event) => setSellerAddress(event.target.value)} placeholder="0x..." />
          </Field>
          <Field label="Agent Address">
            <input value={agentAddress} onChange={(event) => setAgentAddress(event.target.value)} placeholder="0x..." />
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
          <Field label="Deadline">
            <input type="datetime-local" value={deadlineInput} onChange={(event) => setDeadlineInput(event.target.value)} />
          </Field>
          <Field label="EOI Amount">
            <input value={eoiAmount} onChange={(event) => setEoiAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Deposit Amount">
            <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Final Amount">
            <input value={finalAmount} onChange={(event) => setFinalAmount(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <div className="sqmu-stats">
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Factory</span>
            <strong>{appConfig.contracts.escrowFactory ? maskAddress(appConfig.contracts.escrowFactory) : 'Not configured'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Token Allowed</span>
            <strong>{paymentTokenAddress ? (tokenAllowed ? 'Yes' : 'No') : '—'}</strong>
          </div>
          <div className="sqmu-stat">
            <span className="sqmu-stat-label">Related Escrows</span>
            <strong>{Array.isArray(relatedEscrows) ? relatedEscrows.length : 0}</strong>
          </div>
        </div>
      </Section>
      <p className="sqmu-status-line">{status}</p>
    </div>
  );
}

function EscrowView({ appConfig }) {
  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={false} />
      {appConfig.escrowAddress && isAddress(appConfig.escrowAddress) ? (
        <ExistingEscrowPanel appConfig={appConfig} escrowAddress={appConfig.escrowAddress} />
      ) : (
        <EscrowCreatePanel appConfig={appConfig} />
      )}
    </div>
  );
}

function CrowdfundAdminSection({ appConfig }) {
  if (!appConfig.contracts.crowdfund) {
    return (
      <Section title="Crowdfund Owner Tools" help="Configure contracts.crowdfund in Settings > SQMU App before using these owner actions.">
        <p className="sqmu-help">Crowdfund owner operations are unavailable until the Crowdfund contract address is configured.</p>
      </Section>
    );
  }

  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const paymentTokens = useResolvedPaymentTokens(appConfig);
  const [priceInput, setPriceInput] = useState('');
  const [withdrawTokenAddress, setWithdrawTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: currentPrice } = useReadContract({
    address: appConfig.contracts.crowdfund,
    abi: crowdfundAbi,
    functionName: 'priceUSD',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.crowdfund) }
  });

  useEffect(() => {
    if (currentPrice !== undefined) {
      setPriceInput(Number(formatUnits(toBigInt(currentPrice), 18)).toFixed(2));
    }
  }, [currentPrice]);

  const selectedWithdrawToken = paymentTokens.find(
    (token) => token.address.toLowerCase() === withdrawTokenAddress.toLowerCase()
  );
  const withdrawUnits = selectedWithdrawToken ? parseTokenUnits(withdrawAmount, selectedWithdrawToken.decimals) : 0n;

  const setCrowdfundPrice = async () => {
    const priceUnits = parseTokenUnits(priceInput, 18);
    if (priceUnits === null) {
      setStatus('Enter a valid USD price.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.crowdfund,
        abi: crowdfundAbi,
        functionName: 'setPriceUSD',
        args: [priceUnits],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Crowdfund price updated: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Failed to update crowdfund price.');
    } finally {
      setBusy(false);
    }
  };

  const withdrawCrowdfundPayments = async () => {
    if (!selectedWithdrawToken) {
      setStatus('Select a payment token to withdraw.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.crowdfund,
        abi: crowdfundAbi,
        functionName: 'withdrawPayments',
        args: [selectedWithdrawToken.address, withdrawAmount ? withdrawUnits : 0n],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Crowdfund withdrawal submitted: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || 'Failed to withdraw crowdfund payments.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Crowdfund Owner Tools" help="Set governance price and withdraw collected payments.">
      <div className="sqmu-form-grid">
        <Field label="Current Price (USD)">
          <input value={priceInput} onChange={(event) => setPriceInput(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Withdraw Token">
          <select value={withdrawTokenAddress} onChange={(event) => setWithdrawTokenAddress(event.target.value)}>
            {paymentTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Withdraw Amount" hint="Leave blank to pass 0 and withdraw full balance.">
          <input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} inputMode="decimal" />
        </Field>
      </div>
      <div className="sqmu-actions">
        <button type="button" className="wp-element-button" onClick={setCrowdfundPrice} disabled={busy}>
          {busy ? 'Submitting...' : 'Set Price'}
        </button>
        <button type="button" className="wp-element-button" onClick={withdrawCrowdfundPayments} disabled={busy}>
          {busy ? 'Submitting...' : 'Withdraw Payments'}
        </button>
      </div>
      <p className="sqmu-status-line">{status}</p>
    </Section>
  );
}

function RentAdminSection({ appConfig }) {
  if (!appConfig.contracts.rent) {
    return (
      <Section title="Rent Owner Tools" help="Configure contracts.rent in Settings > SQMU App before using these owner actions.">
        <p className="sqmu-help">Rent owner operations are unavailable until the Rent contract address is configured.</p>
      </Section>
    );
  }

  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const paymentTokens = useResolvedPaymentTokens(appConfig);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [acceptedStatus, setAcceptedStatus] = useState(true);
  const [treasuryAddress, setTreasuryAddress] = useState('');
  const [managementFee, setManagementFee] = useState('');
  const [vaultAddress, setVaultAddress] = useState(appConfig.contracts.rentDistribution || '');
  const [refundPropertyId, setRefundPropertyId] = useState('');
  const [refundTenant, setRefundTenant] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [feeWithdrawTokenAddress, setFeeWithdrawTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [nftTokenAddress, setNftTokenAddress] = useState(appConfig.contracts.sqmu || '');
  const [nftTokenId, setNftTokenId] = useState('');
  const [nftAmount, setNftAmount] = useState('');
  const [nftToAddress, setNftToAddress] = useState('');
  const [nftData, setNftData] = useState('0x');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: currentAccepted } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'acceptedTokens',
    args: [selectedTokenAddress || '0x0000000000000000000000000000000000000000'],
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.rent && selectedTokenAddress) }
  });

  const { data: currentTreasury } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'treasury',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.rent) }
  });

  const { data: currentManagementFee } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'managementFee',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.rent) }
  });

  const { data: currentVault } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'vault',
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.rent) }
  });

  const refundPropertyIdValue = parseIntegerUnits(refundPropertyId);
  const { data: depositDetails } = useReadContract({
    address: appConfig.contracts.rent,
    abi: rentAbi,
    functionName: 'getDepositDetails',
    args: [refundPropertyIdValue ?? 0n],
    chainId: appConfig.defaultChainId,
    query: { enabled: Boolean(appConfig.contracts.rent && refundPropertyIdValue !== null) }
  });

  const depositTokenAddress = tupleValue(depositDetails, 'token', 1, '');
  const depositTenantAddress = tupleValue(depositDetails, 'tenant', 2, '');
  const depositTokenMeta = paymentTokens.find(
    (token) => depositTokenAddress && token.address.toLowerCase() === depositTokenAddress.toLowerCase()
  );
  const refundUnits = depositTokenMeta ? parseTokenUnits(refundAmount, depositTokenMeta.decimals) : null;

  useEffect(() => {
    if (currentAccepted !== undefined) {
      setAcceptedStatus(Boolean(currentAccepted));
    }
  }, [currentAccepted]);

  useEffect(() => {
    if (currentTreasury) {
      setTreasuryAddress(currentTreasury);
    }
  }, [currentTreasury]);

  useEffect(() => {
    if (currentManagementFee !== undefined) {
      setManagementFee(String(currentManagementFee));
    }
  }, [currentManagementFee]);

  useEffect(() => {
    if (currentVault) {
      setVaultAddress(currentVault);
    }
  }, [currentVault]);

  useEffect(() => {
    if (depositTenantAddress) {
      setRefundTenant(depositTenantAddress);
    }
  }, [depositTenantAddress]);

  const submitRentOperation = async (functionName, args, successMessage) => {
    setBusy(true);
    try {
      await ensureReady();
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.rent,
        abi: rentAbi,
        functionName,
        args,
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`${successMessage}: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || `${successMessage} failed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Rent Owner Tools" help="Restricted owner and operator actions for the SQMU Rent contract.">
      <div className="sqmu-form-grid">
        <Field label="Accepted Token">
          <select value={selectedTokenAddress} onChange={(event) => setSelectedTokenAddress(event.target.value)}>
            {paymentTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accepted Status">
          <select value={acceptedStatus ? '1' : '0'} onChange={(event) => setAcceptedStatus(event.target.value === '1')}>
            <option value="1">Allowed</option>
            <option value="0">Blocked</option>
          </select>
        </Field>
      </div>
      <div className="sqmu-actions">
        <button type="button" className="wp-element-button" onClick={() => submitRentOperation('setAcceptedToken', [selectedTokenAddress, acceptedStatus], 'Accepted token updated')} disabled={busy}>
          {busy ? 'Submitting...' : 'Set Accepted Token'}
        </button>
      </div>

      <div className="sqmu-form-grid">
        <Field label="Treasury Address">
          <input value={treasuryAddress} onChange={(event) => setTreasuryAddress(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Management Fee (bps)">
          <input value={managementFee} onChange={(event) => setManagementFee(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Vault Address">
          <input value={vaultAddress} onChange={(event) => setVaultAddress(event.target.value)} placeholder="0x..." />
        </Field>
      </div>
      <div className="sqmu-actions">
        <button type="button" className="wp-element-button" onClick={() => submitRentOperation('setTreasury', [treasuryAddress], 'Treasury updated')} disabled={busy}>
          {busy ? 'Submitting...' : 'Set Treasury'}
        </button>
        <button type="button" className="wp-element-button" onClick={() => submitRentOperation('setManagementFee', [parseIntegerUnits(managementFee) ?? 0n], 'Management fee updated')} disabled={busy}>
          {busy ? 'Submitting...' : 'Set Management Fee'}
        </button>
        <button type="button" className="wp-element-button" onClick={() => submitRentOperation('setVault', [vaultAddress], 'Vault updated')} disabled={busy}>
          {busy ? 'Submitting...' : 'Set Vault'}
        </button>
      </div>

      <div className="sqmu-form-grid">
        <Field label="Refund Property ID">
          <input value={refundPropertyId} onChange={(event) => setRefundPropertyId(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Refund Tenant">
          <input value={refundTenant} onChange={(event) => setRefundTenant(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Refund Amount" hint={depositTokenMeta ? `Decimals: ${depositTokenMeta.decimals}` : 'Loads from the deposit token when available.'}>
          <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} inputMode="decimal" />
        </Field>
      </div>
      <div className="sqmu-actions">
        <button
          type="button"
          className="wp-element-button"
          onClick={() => submitRentOperation('refundDeposit', [refundPropertyIdValue ?? 0n, refundTenant, refundUnits ?? 0n], 'Deposit refund submitted')}
          disabled={busy}
        >
          {busy ? 'Submitting...' : 'Refund Deposit'}
        </button>
      </div>

      <div className="sqmu-form-grid">
        <Field label="Fee Withdraw Token">
          <select value={feeWithdrawTokenAddress} onChange={(event) => setFeeWithdrawTokenAddress(event.target.value)}>
            {paymentTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sqmu-actions">
        <button
          type="button"
          className="wp-element-button"
          onClick={() => submitRentOperation('withdrawManagementFees', [feeWithdrawTokenAddress], 'Management fee withdrawal submitted')}
          disabled={busy}
        >
          {busy ? 'Submitting...' : 'Withdraw Management Fees'}
        </button>
      </div>

      <div className="sqmu-form-grid">
        <Field label="NFT Token Address">
          <input value={nftTokenAddress} onChange={(event) => setNftTokenAddress(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="NFT Token ID">
          <input value={nftTokenId} onChange={(event) => setNftTokenId(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="NFT Amount">
          <input value={nftAmount} onChange={(event) => setNftAmount(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Withdraw To">
          <input value={nftToAddress} onChange={(event) => setNftToAddress(event.target.value)} placeholder="0x..." />
        </Field>
        <Field label="Deposit Data" hint="Hex bytes, defaults to 0x">
          <input value={nftData} onChange={(event) => setNftData(event.target.value)} placeholder="0x" />
        </Field>
      </div>
      <div className="sqmu-actions">
        <button
          type="button"
          className="wp-element-button"
          onClick={() => submitRentOperation('depositNFT', [nftTokenAddress, parseIntegerUnits(nftTokenId) ?? 0n, parseIntegerUnits(nftAmount) ?? 0n, nftData || '0x'], 'Rent NFT deposit submitted')}
          disabled={busy}
        >
          {busy ? 'Submitting...' : 'Deposit NFT'}
        </button>
        <button
          type="button"
          className="wp-element-button"
          onClick={() => submitRentOperation('withdrawNFT', [nftTokenAddress, parseIntegerUnits(nftTokenId) ?? 0n, parseIntegerUnits(nftAmount) ?? 0n, nftToAddress], 'Rent NFT withdrawal submitted')}
          disabled={busy}
        >
          {busy ? 'Submitting...' : 'Withdraw NFT'}
        </button>
      </div>

      <p className="sqmu-status-line">{status}</p>
    </Section>
  );
}

function EscrowFactoryAdminSection({ appConfig }) {
  if (!appConfig.contracts.escrowFactory) {
    return (
      <Section title="Escrow Factory Owner Tools" help="Configure contracts.escrowFactory in Settings > SQMU App before using token allowlist controls.">
        <p className="sqmu-help">Escrow Factory operations are unavailable until the factory address is configured.</p>
      </Section>
    );
  }

  const { address, publicClient, walletClient, ensureReady } = useAppWallet(appConfig);
  const paymentTokens = useResolvedPaymentTokens(appConfig);
  const [tokenAddress, setTokenAddress] = useState(appConfig.paymentTokens[0]?.address ?? '');
  const [status, setStatus] = useState('Ready.');
  const [busy, setBusy] = useState(false);

  const { data: currentAllowed } = useReadContract({
    address: appConfig.contracts.escrowFactory,
    abi: escrowFactoryAbi,
    functionName: 'allowedTokens',
    args: [tokenAddress || '0x0000000000000000000000000000000000000000'],
    chainId: appConfig.defaultChainId,
    query: {
      enabled: Boolean(appConfig.contracts.escrowFactory && tokenAddress)
    }
  });

  const submitEscrowFactoryAction = async (functionName, successMessage) => {
    if (!tokenAddress || !isAddress(tokenAddress)) {
      setStatus('Enter a valid token address.');
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      const txHash = await walletClient.writeContract({
        address: appConfig.contracts.escrowFactory,
        abi: escrowFactoryAbi,
        functionName,
        args: [tokenAddress],
        account: address,
        chain: walletClient.chain
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`${successMessage}: ${txHash}`);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || `${successMessage} failed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Escrow Factory Owner Tools" help="Token whitelist controls for the Escrow Factory. Upgrade and implementation controls are intentionally excluded.">
      <div className="sqmu-form-grid">
        <Field label="Token">
          <select value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)}>
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
          <span className="sqmu-stat-label">Currently Allowed</span>
          <strong>{currentAllowed ? 'Yes' : 'No'}</strong>
        </div>
      </div>
      <div className="sqmu-actions">
        <button type="button" className="wp-element-button" onClick={() => submitEscrowFactoryAction('addAllowedToken', 'Allowed token added')} disabled={busy}>
          {busy ? 'Submitting...' : 'Allow Token'}
        </button>
        <button type="button" className="wp-element-button" onClick={() => submitEscrowFactoryAction('removeAllowedToken', 'Allowed token removed')} disabled={busy}>
          {busy ? 'Submitting...' : 'Remove Token'}
        </button>
      </div>
      <p className="sqmu-status-line">{status}</p>
    </Section>
  );
}

function AdminOperationsView({ appConfig }) {
  if (!appConfig.currentUser.canManageOptions) {
    return <ConfigError issues={['This admin operations page is restricted to administrators.']} />;
  }

  return (
    <div className="sqmu-stack">
      <WalletPanel appConfig={appConfig} desiredChainId={appConfig.defaultChainId} busy={false} />
      <CrowdfundAdminSection appConfig={appConfig} />
      <RentAdminSection appConfig={appConfig} />
      <EscrowFactoryAdminSection appConfig={appConfig} />
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

function validateMountConfig(view, appConfig) {
  const issues = [];
  if (!appConfig.chains.length) {
    issues.push('At least one chain configuration is required.');
  }
  if (!appConfig.chains.some((chain) => chain.id === appConfig.defaultChainId)) {
    issues.push('defaultChainId must match one of the configured chains.');
  }
  if (!appConfig.chains.every((chain) => chain.rpcUrl)) {
    issues.push('Each configured chain must include an rpcUrl for browser-side reads.');
  }

  const requiredContractsByView = {
    buy: ['distributor'],
    portfolio: ['distributor', 'trade', 'sqmu'],
    crowdfund: ['crowdfund', 'sqmu'],
    rent: ['rent'],
    rent_distribution: ['rentDistribution'],
    escrow: appConfig.escrowAddress ? [] : ['escrowFactory'],
    admin_ops: []
  };

  (requiredContractsByView[view] ?? []).forEach((key) => {
    if (!appConfig.contracts[key]) {
      issues.push(`contracts.${key} is required.`);
    }
  });

  if (view === 'escrow' && appConfig.escrowAddress && !isAddress(appConfig.escrowAddress)) {
    issues.push('escrowAddress must be a valid address when provided for the escrow view.');
  }

  if (view === 'admin_ops' && !appConfig.currentUser.canManageOptions) {
    issues.push('Administrator capability is required for the operations page.');
  }

  return issues;
}

function App({ mountConfig }) {
  const appConfig = normalizeConfig(mountConfig.config);
  const issues = [...(mountConfig.errors ?? []), ...validateMountConfig(mountConfig.view, appConfig)];

  if (issues.length) {
    return <ConfigError issues={Array.from(new Set(issues))} />;
  }

  const view = mountConfig.view;
  const cacheKey = JSON.stringify({ view, config: appConfig });
  const config = getWagmiConfig(appConfig);
  const queryClient = getQueryClient(cacheKey);

  let content = null;
  if (view === 'portfolio') {
    content = <PortfolioView appConfig={appConfig} />;
  } else if (view === 'crowdfund') {
    content = <CrowdfundView appConfig={appConfig} />;
  } else if (view === 'rent') {
    content = <RentView appConfig={appConfig} />;
  } else if (view === 'rent_distribution') {
    content = <RentDistributionView appConfig={appConfig} />;
  } else if (view === 'escrow') {
    content = <EscrowView appConfig={appConfig} />;
  } else if (view === 'admin_ops') {
    content = <AdminOperationsView appConfig={appConfig} />;
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
            <StatusPill tone="neutral">{appConfig.context === 'admin' ? 'wp-admin' : 'React + Wagmi'}</StatusPill>
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
