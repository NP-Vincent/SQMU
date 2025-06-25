 WPSmartContract allows as to create a token on any network for free. Gas fees for creating the smart contract applies. However, once this is done, a pre-defined supply of the ERC-20 token SQMU can then be used as a fractional representation of square metre of the property. The SQMU is transferred from the smart contract to the buyer upon payment.   The following components need to seamlessly interact with each other. 

- WPSmartContract - smart contract that creates and controls the supply of the SQMU - ERC-20 token for each property. For the early operations the chain used is Polygon.
- A Sale smart contract on the same chain, in this case Polygon, which is approved to interact with the WPSmartContract and functions as a sales process or delivery process contract. Sending the SQMU to the buyer based on the fixed exchange rate of SQMU to USD. Based on confirmation of payment.
- A payment page or checkout page which processes USDT (Ethereum), USDC (Arbitrum) and USDC (Polygon) payments. The payment page is triggered by a pay button embedded on required pages and listings. The payment page receives the amount in USD and processes the payment in the chosen ERC-20 token and network. Once the transaction is processed and completed it triggers the Sale smart contract to send the SQMU equivalent of the USD received to the buyer.
- A button that collects information about the property, the price and in the case of SQMU the number of SQMUs being purchased and provides a USD value for the payment page to process.   

The WPSmartContract is Wordpress plugin and the interface and process is relatively simple to create an ERC-20 SQMU token. A SQMU ERC-20 token will be created for each fractionalised property that is listed. The supply of the SQMU will be equal to the square metre of the listed property.   The Sale or Delivery smartcontract is written in Solidity and deployed to Polygon chain through remix.ethereum.org This too is relatively simple to do. However, at the moment it will need to be created for each SQMU ERC-20 token created. 

The payment page is coded and deployed. It will trigger the SALE or Delivery contract residing on Polygon. The payment page is a HTML + JS code embedded with CustomHTML Block on wordpress.com, the page is treated as a single check out page for multiple functions. 

The button is also a code snippet HTML + JS that is embedded as CustomHTML Block in a page template that will be applicable for all properties of similar type. There are 2 types fractionalised and non-fractionalised.

Mobile users should open the checkout page inside their wallet browser (preferably MetaMask) because other wallets may refresh and lose form data.

