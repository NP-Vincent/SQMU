import { formatUnits } from 'ethers';
import {
  createDistributorContract,
  createDistributorReadOnly,
  defaultDistributorAddress
} from '../contracts/atomicDistributor.js';
import { createErc20Contract } from '../contracts/erc20.js';
import {
  getPaymentToken,
  getPaymentTokensFromList
} from '../utils/paymentTokens.js';

const USD_DECIMALS = 18n;
const SQMU_DECIMALS = 2n;

export const renderButton = (label, action, variant) => {
  const config =
    typeof label === 'object'
      ? label
      : {
          label,
          action,
          variant
        };

  const actions = document.createElement('div');
  actions.className = 'wp-block-buttons';

  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'wp-block-button';
  if (config.variant) {
    buttonWrapper.classList.add(`is-style-${config.variant}`);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'wp-block-button__link';
  button.dataset.action = config.action;
  button.textContent = config.label;

  buttonWrapper.appendChild(button);
  actions.appendChild(buttonWrapper);

  return { wrapper: actions, button };
};

export const renderInput = ({
  type = 'text',
  name,
  placeholder,
  value,
  min,
  step,
  readOnly = false
} = {}) => {
  const input = document.createElement('input');
  input.className = 'wp-block-input';
  input.type = type;
  if (name) input.name = name;
  if (placeholder) input.placeholder = placeholder;
  if (value !== undefined) input.value = value;
  if (min !== undefined) input.min = min;
  if (step !== undefined) input.step = step;
  input.readOnly = readOnly;
  return input;
};

export const renderSelect = ({ name } = {}) => {
  const select = document.createElement('select');
  select.className = 'wp-block-select';
  if (name) select.name = name;
  return select;
};

export const renderField = (labelText, input) => {
  const config =
    typeof labelText === 'object'
      ? labelText
      : {
          label: labelText,
          control: input
        };
  const wrapper = document.createElement('div');
  wrapper.className = 'sqmu-field';

  const label = document.createElement('div');
  label.className = 'sqmu-label';
  label.textContent = config.label;

  wrapper.appendChild(label);
  if (config.control) {
    wrapper.appendChild(config.control);
  }
  return wrapper;
};

export const renderForm = (fields = []) => {
  const form = document.createElement('div');
  form.className = 'sqmu-form';
  fields.forEach((field) => {
    if (field) {
      form.appendChild(field);
    }
  });
  return form;
};

export const renderActions = (actions = []) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'sqmu-actions';
  actions.forEach((action) => {
    if (action) {
      wrapper.appendChild(action);
    }
  });
  return wrapper;
};

export const renderCard = ({ title, statusLines = [] } = {}) => {
  const card = document.createElement('div');
  card.className = 'sqmu-card';

  const header = document.createElement('div');
  header.className = 'sqmu-header';

  const titleElement = document.createElement('h3');
  titleElement.className = 'sqmu-title';
  titleElement.textContent = title ?? '';

  const statusWrap = document.createElement('div');
  statusWrap.className = 'sqmu-status';

  statusLines.forEach((line) => {
    if (!line) {
      return;
    }
    if (typeof line === 'string') {
      const textLine = document.createElement('p');
      textLine.textContent = line;
      statusWrap.appendChild(textLine);
    } else {
      statusWrap.appendChild(line);
    }
  });

  header.append(titleElement, statusWrap);
  card.appendChild(header);

  return {
    card,
    header,
    titleElement,
    statusWrap
  };
};

export const renderSection = ({
  title,
  form = [],
  actions = [],
  body = []
} = {}) => {
  const section = document.createElement('section');
  section.className = 'sqmu-section';

  const sectionTitle = document.createElement('h4');
  sectionTitle.className = 'sqmu-section-title';
  sectionTitle.textContent = title ?? '';

  const formEl = renderForm(form);
  const actionsEl = renderActions(actions);

  section.appendChild(sectionTitle);
  section.appendChild(formEl);
  section.appendChild(actionsEl);

  body.forEach((item) => {
    if (item) {
      section.appendChild(item);
    }
  });

  return section;
};

export const renderTableWrap = (table) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'sqmu-table-wrap';
  if (table) {
    wrapper.appendChild(table);
  }
  return wrapper;
};

const renderStatus = (status, detail) => {
  status.textContent = detail;
};

const shortenErrorMessage = (message, maxLength = 120) => {
  if (!message) return '';
  const firstLine = message.split('\n')[0].trim();
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength - 3)}...`;
};

const formatErrorMessage = (error) => {
  const code =
    error?.code ?? error?.error?.code ?? error?.data?.code ?? null;
  if (code === 4001) {
    return 'User rejected the request.';
  }
  if (code === -32002) {
    return 'Request already pending in wallet.';
  }
  const message = shortenErrorMessage(
    typeof error === 'string' ? error : error?.message || 'Unknown error.'
  );
  return message || 'Unknown error.';
};

const renderActionError = (status, actionLabel, error) => {
  renderStatus(status, `${actionLabel} failed: ${formatErrorMessage(error)}`);
};

const shorten = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not connected';

const parseSqmuAmount = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [wholePart, fractionPart = ''] = trimmed.split('.');
  if (fractionPart.length > Number(SQMU_DECIMALS)) return null;
  const paddedFraction = fractionPart.padEnd(Number(SQMU_DECIMALS), '0');
  const base = 10n ** SQMU_DECIMALS;
  return BigInt(wholePart) * base + BigInt(paddedFraction);
};

const calculateTotalPrice = (priceUSD, sqmuAmount, tokenDecimals) => {
  const decimals = 10n ** BigInt(tokenDecimals);
  return (priceUSD * sqmuAmount * decimals) / 10n ** USD_DECIMALS;
};

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

const enforceChain = (state, config) => {
  const expected = normalizeChainId(config.chainId);
  if (expected && state.chainId && expected !== state.chainId) {
    throw new Error(`Switch to chain ${expected} before proceeding.`);
  }
};

export function mountDappUI(mount, state, config = {}) {
  if (!mount) {
    return null;
  }

  mount.innerHTML = '';
  mount.classList.add('sqmu-widget');

  const grid = document.createElement('div');
  grid.className = 'sqmu-grid';

  const heading = document.createElement('h2');
  heading.textContent = 'SQMU Distributor';

  const status = document.createElement('p');
  const accountLine = document.createElement('p');
  const chainLine = document.createElement('p');

  const connectButton = renderButton('Connect MetaMask', 'connect');
  const disconnectButton = renderButton('Disconnect wallet', 'disconnect');

  const contractAddressInput = renderInput({
    placeholder: '0x...',
    value: config.contractAddress || defaultDistributorAddress || ''
  });

  const propertyCodeInput = renderInput({
    placeholder: 'Property code'
  });

  const fetchPropertyButton = renderButton(
    'Fetch property details',
    'fetch-property'
  );

  const propertyInfo = document.createElement('pre');
  propertyInfo.textContent = 'No property loaded.';
  propertyInfo.className = 'sqmu-pre';

  const paymentTokenSelect = renderSelect();
  const refreshTokensButton = renderButton(
    'Load payment tokens',
    'load-tokens'
  );

  const sqmuAmountInput = renderInput({
    type: 'number',
    min: '0.01',
    step: '0.01'
  });

  const agentCodeInput = renderInput({
    placeholder: 'Optional agent code'
  });

  const estimateButton = renderButton(
    'Estimate total price',
    'estimate'
  );

  const approveButton = renderButton('Approve payment', 'approve');

  const buyButton = renderButton('Buy SQMU', 'buy');

  const actionStatus = document.createElement('p');

  const getContractAddress = () =>
    contractAddressInput.value.trim() ||
    config.contractAddress ||
    defaultDistributorAddress ||
    '';

  const ensureConnected = () => {
    if (!state.signer) {
      throw new Error('Connect MetaMask first.');
    }
  };

  const ensureWriteReady = async () => {
    ensureConnected();
    await state.ensureChain?.(config.chainId);
    enforceChain(state, config);
  };

  const updateConnectionStatus = () => {
    renderStatus(
      status,
      state.connected
        ? `Connected to ${shorten(state.account)}`
        : 'Wallet not connected.'
    );
    accountLine.textContent = `Account: ${state.account ?? 'N/A'}`;
    chainLine.textContent = `Chain ID: ${state.chainId ?? 'N/A'}`;
  };

  const contractForRead = () => {
    ensureConnected();
    return createDistributorReadOnly({
      provider: state.ethersProvider,
      address: getContractAddress()
    });
  };

  const contractForWrite = async () => {
    await ensureWriteReady();
    return createDistributorContract({
      signer: state.signer,
      address: getContractAddress()
    });
  };

  const updateTokensList = (tokens) => {
    const resolvedTokens = getPaymentTokensFromList(tokens);
    paymentTokenSelect.innerHTML = '';
    if (!resolvedTokens.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No tokens available';
      paymentTokenSelect.appendChild(option);
      return;
    }
    resolvedTokens.forEach((token) => {
      const option = document.createElement('option');
      option.value = token.address;
      option.textContent = token.symbol;
      paymentTokenSelect.appendChild(option);
    });
  };

  connectButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Connecting to MetaMask...');
    try {
      await state.connect();
      renderStatus(actionStatus, 'Connected.');
    } catch (error) {
      renderActionError(actionStatus, 'Connection', error);
    }
  });

  disconnectButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Disconnecting wallet...');
    try {
      await state.disconnect?.();
      renderStatus(actionStatus, 'Disconnected.');
    } catch (error) {
      renderActionError(actionStatus, 'Disconnect', error);
    }
  });

  fetchPropertyButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Fetching property info...');
    try {
      const propertyCode = propertyCodeInput.value.trim();
      if (!propertyCode) {
        throw new Error('Enter a property code.');
      }
      const contract = contractForRead();
      const [property, available, statusValue] = await Promise.all([
        contract.getPropertyInfo(propertyCode),
        contract.getAvailable(propertyCode),
        contract.getPropertyStatus(propertyCode)
      ]);
      propertyInfo.textContent = [
        `Name: ${property.name}`,
        `Token Address: ${property.tokenAddress}`,
        `Token ID: ${property.tokenId}`,
        `Treasury: ${property.treasury}`,
        `Price (USD, 18 decimals): ${property.priceUSD}`,
        `Active: ${statusValue ? 'Yes' : 'No'}`,
        `Available SQMU: ${available}`
      ].join('\n');
      renderStatus(actionStatus, 'Property loaded.');
    } catch (error) {
      renderActionError(actionStatus, 'Property lookup', error);
    }
  });

  refreshTokensButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Loading payment tokens...');
    try {
      const contract = contractForRead();
      const tokens = await contract.getPaymentTokens();
      updateTokensList(tokens);
      renderStatus(actionStatus, 'Payment tokens loaded.');
    } catch (error) {
      renderActionError(actionStatus, 'Token load', error);
    }
  });

  estimateButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Estimating price...');
    try {
      const propertyCode = propertyCodeInput.value.trim();
      const sqmuAmount = parseSqmuAmount(sqmuAmountInput.value);
      if (!propertyCode || sqmuAmount === null) {
        throw new Error('Enter property code and SQMU amount.');
      }
      const tokenAddress = paymentTokenSelect.value.trim();
      if (!tokenAddress) {
        throw new Error('Select a payment token.');
      }
      const contract = contractForRead();
      const property = await contract.getPropertyInfo(propertyCode);
      const token = getPaymentToken(tokenAddress);
      if (!token) {
        throw new Error('Selected payment token is not supported.');
      }
      const erc20 = createErc20Contract({
        signer: state.signer,
        address: token.address
      });
      const symbol = await erc20.symbol();
      const totalPrice = calculateTotalPrice(
        property.priceUSD,
        sqmuAmount,
        token.decimals
      );
      const formatted = formatUnits(totalPrice, token.decimals);
      renderStatus(
        actionStatus,
        `Estimated total: ${formatted} ${symbol || token.symbol}`
      );
    } catch (error) {
      renderActionError(actionStatus, 'Estimate', error);
    }
  });

  approveButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Approving payment...');
    try {
      const propertyCode = propertyCodeInput.value.trim();
      const sqmuAmount = parseSqmuAmount(sqmuAmountInput.value);
      const tokenAddress = paymentTokenSelect.value.trim();
      if (!propertyCode || sqmuAmount === null || !tokenAddress) {
        throw new Error('Fill property, amount, and token.');
      }
      await ensureWriteReady();
      const contract = contractForRead();
      const property = await contract.getPropertyInfo(propertyCode);
      const token = getPaymentToken(tokenAddress);
      if (!token) {
        throw new Error('Selected payment token is not supported.');
      }
      const erc20 = createErc20Contract({
        signer: state.signer,
        address: token.address
      });
      const totalPrice = calculateTotalPrice(
        property.priceUSD,
        sqmuAmount,
        token.decimals
      );
      const tx = await erc20.approve(getContractAddress(), totalPrice);
      renderStatus(actionStatus, `Approval submitted: ${tx.hash}`);
      await tx.wait();
      renderStatus(actionStatus, 'Approval confirmed.');
    } catch (error) {
      renderActionError(actionStatus, 'Approval', error);
    }
  });

  buyButton.button.addEventListener('click', async () => {
    renderStatus(actionStatus, 'Submitting purchase...');
    try {
      const propertyCode = propertyCodeInput.value.trim();
      const sqmuAmount = parseSqmuAmount(sqmuAmountInput.value);
      const tokenAddress = paymentTokenSelect.value.trim();
      if (!propertyCode || sqmuAmount === null || !tokenAddress) {
        throw new Error('Fill property, amount, and token.');
      }
      const agentCode = agentCodeInput.value.trim();
      const contract = await contractForWrite();
      const tx = await contract.buySQMU(
        propertyCode,
        sqmuAmount,
        tokenAddress,
        agentCode
      );
      renderStatus(actionStatus, `Transaction submitted: ${tx.hash}`);
      await tx.wait();
      renderStatus(actionStatus, 'Purchase confirmed.');
    } catch (error) {
      renderActionError(actionStatus, 'Purchase', error);
    }
  });

  updateConnectionStatus();
  state.subscribe(updateConnectionStatus);

  grid.appendChild(heading);
  grid.appendChild(status);
  grid.appendChild(accountLine);
  grid.appendChild(chainLine);
  grid.appendChild(connectButton.wrapper);
  grid.appendChild(disconnectButton.wrapper);
  grid.appendChild(renderField('Distributor contract address', contractAddressInput));
  grid.appendChild(renderField('Property code', propertyCodeInput));
  grid.appendChild(fetchPropertyButton.wrapper);
  grid.appendChild(propertyInfo);
  grid.appendChild(refreshTokensButton.wrapper);
  grid.appendChild(renderField('Payment token', paymentTokenSelect));
  grid.appendChild(renderField('SQMU amount', sqmuAmountInput));
  grid.appendChild(renderField('Agent code', agentCodeInput));
  grid.appendChild(estimateButton.wrapper);
  grid.appendChild(approveButton.wrapper);
  grid.appendChild(buyButton.wrapper);
  grid.appendChild(actionStatus);
  mount.appendChild(grid);

  return state;
}

export function mountUI(state, config = {}) {
  const mountSelector = config.mountSelector || '#metamask-dapp';
  const mount = config.mountEl || document.querySelector(mountSelector);
  return mountDappUI(mount, state, config);
}
