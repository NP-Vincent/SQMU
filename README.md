The following components need to seamlessly interact with each other. 

- WPSmartContract - smart contract that creates and controls the supply of the SQMU - ERC-20 token for each property. For the early operations the chain used is Polygon.
- A Sale smart contract on the same chain, in this case Polygon, which is approved to interact with the WPSmartContract and functions as a sales process or delivery process contract. Sending the SQMU to the buyer based on the fixed exchange rate of SQMU to USD. Based on confirmation of payment.
- A payment page or checkout page which processes USDT (Ethereum), USDC (Arbitrum) and USDC (Polygon) payments. The payment page is triggered by a pay button embedded on required pages and listings. The payment page receives the amount in USD and processes the payment in the chosen ERC-20 token and network. Once the transaction is processed and completed it triggers the Sale smart contract to send the SQMU equivalent of the USD received to the buyer.
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

