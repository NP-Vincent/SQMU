The following components need to seamlessly interact with each other. 

- WPSmartContract - smart contract that creates and controls the supply of the SQMU - ERC-20 token for each property. For the early operations the chain used is Polygon.
- A Sale smart contract on the same chain, in this case Polygon, which is approved to interact with the WPSmartContract and functions as a sales process or delivery process contract. Sending the SQMU to the buyer based on the fixed exchange rate of SQMU to USD. Based on confirmation of payment.
- A payment page or checkout page which processes USDT (Ethereum), USDC (Arbitrum), USDC (Polygon) and USDT/USDC (Scroll) payments. The payment page is triggered by a pay button embedded on required pages and listings. The payment page receives the amount in USD and processes the payment in the chosen ERC-20 token and network. Once the transaction is processed and completed it triggers the Sale smart contract to send the SQMU equivalent of the USD received to the buyer. The Ethereum USDT token address is `0xdAC17F958D2ee523a2206206994597C13D831ec7`, the Arbitrum USDC token address is `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` and the Polygon USDC token address is `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`. The Scroll token addresses are `0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df` for USDT and `0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4` for USDC. Scroll mainnet uses chain ID `534352` with RPC `https://rpc.scroll.io` and transactions can be viewed on `https://scrollscan.com`. Ethereum uses chain ID `1` with RPC `https://rpc.ankr.com/eth` and `https://etherscan.io`, Arbitrum One uses chain ID `42161` with RPC `https://arb1.arbitrum.io/rpc` and `https://arbiscan.io`, and Polygon uses chain ID `137` with RPC `https://polygon-rpc.com` and `https://polygonscan.com`.
The **SQMU Amount** input accepts decimal values like `14.76`. When you submit
the form the admin page converts this string using `ethers.parseUnits` before
calling `distribute` so the contract receives the correct token units.

4. Deploy the contract with the SQMU token address, the USDC token address on Polygon and the treasury wallet.
5. The treasury must hold enough USDC and approve this contract to spend it so commissions can be paid.
6. Use the new contract address in the payment widgets.


Only the contract owner can call `distribute` after the latest update. The
page accepts fractional SQMU amounts and pays agent commissions in USDC when a
valid agent code is provided.
## Deploying MultiSqmuDistributor
1. Open [Remix](https://remix.ethereum.org) and create a new file with the contents of `MultiSqmuDistributor.sol`.

Use `admin.html` to register agents and send SQMU manually. Set `CONTRACT_ADDR` to your `MultiSqmuDistributor` address and `APPS_SCRIPT_URL` to the deployed `record.gs` web app URL before embedding the file in WordPress.

The button is also a code snippet HTML + JS that is embedded as CustomHTML Block in a page template that will be applicable for all properties of similar type. There are 2 types fractionalised and non-fractionalised.

### Registering Properties

After deploying `MultiSqmuDistributor` call `setProperty` for each SQMU token:

```
// price is USD per SQMU scaled by STABLE_DECIMALS (6)
setProperty('SQMU', '0xTokenAddress', '0xTreasuryAddress', 1000000)
```

`1000000` represents $1.00 when `STABLE_DECIMALS` is `6`. Adjust the value
for your property's price per SQMU.

The admin page includes a **Register Property** form which posts the property
name, code, token and treasury addresses to `record.gs` for logging. After
submitting it connects to MetaMask and calls `setProperty` so the contract
stores the token, treasury and price on-chain. Enter the USD price per SQMU
so commissions can be calculated. The status area shows the transaction
hash and whether the registration succeeded.

### Setting Exchange Rates

`payment-launch.html` defines a `PROPS` object with default pricing. Add your
property or override values via query parameters like `?price=0.02` or
`?rate=0.02` (USD per SQMU). These parameters are forwarded to the payment page.

### Updated Frontend Usage

Embed `payment-launch.html` on each property page. It collects the SQMU amount
and opens the payment interface (`Metamask 2.1.html`) with details encoded in
the URL. Important parameters include:

- `title` – property name
- `usd` – USD amount to pay
- `sqmu` – SQMU tokens being purchased
- `token` and `chain` – stablecoin and network for payment
- `buy`/`code` – property identifier
- `buyChain` – chain ID where the SQMU token exists
- `sqmuAddr` – token contract address
- `sqmuDec` – token decimals
- `rate` – price per SQMU
- `saleAddr` – your `MultiSqmuDistributor` address

The payment page reads these values, switches networks and calls the contract to
distribute the purchased SQMU tokens.

## Deploying SqmuDistributor

1. Open [Remix](https://remix.ethereum.org) and create a new file with the contents of `SqmuDistributor.sol`.
2. Compile using Solidity ^0.8.0.
3. In the Deploy tab select **Injected Provider** and connect MetaMask to Polygon.
4. Deploy the contract with the SQMU token address and treasury wallet.
5. Use the new contract address in the payment widgets.


## Admin Interface

Use `admin.html` to register agents and send SQMU manually. Set `CONTRACT_ADDR` to your `SqmuDistributor` address and `APPS_SCRIPT_URL` to the deployed `record.gs` web app URL before embedding the file in WordPress.

`record.gs` appends agent details to a Google Sheet named `Agents`. Create the sheet, deploy the script as a web app, and note its `SHEET_ID` in the code.

Only the contract owner can call `distribute` after the latest update.

