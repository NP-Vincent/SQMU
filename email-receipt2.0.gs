function doPost(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput('Missing POST data');
  }
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const chain = e.parameter.chain;
    const token = e.parameter.token;
    const tokenAmt = e.parameter.token_amt;
    const tokenId = e.parameter.token_id;
    const sqmuLink = e.parameter.sqmu_link;
    const tokenAddr = e.parameter.token_addr;
    const fail = e.parameter.fail;
    const prop = e.parameter.prop;
    const propCode = e.parameter.prop_code;
    const sqmuAmt = e.parameter.sqmu_amt;
    const agent = e.parameter.agent;
    if (!(email && txLink && usd && chain && token)) {
      throw new Error('Missing fields');
    }
    let body = 'Thank you for your payment.\n' +
      'Stablecoin tx: ' + txLink + '\n' +
      'Amount: ' + usd + ' USD paid in ' + token + ' on ' + chain + '.';
    if (prop) body += '\nProperty: ' + prop;
    if (propCode) body += '\nProperty code: ' + propCode;
    if (sqmuAmt) body += '\nSQMU amount: ' + sqmuAmt;
    if (agent) body += '\nAgent code: ' + agent;
    if (tokenAmt && tokenId && tokenAddr) {
      body += '\nTokens bought: ' + tokenAmt + ' ' + tokenId +
        '\nToken contract: ' + tokenAddr;
      if (sqmuLink) {
        body += '\nToken purchase tx: ' + sqmuLink;
      }
      body += '\nAdd the contract address above in your wallet to view your purchased SQMU tokens.';
      body += '\nTokens will be sent to the paying wallet within 24 hours.';
    }
    if (fail) {
      body += '\nThere was an issue preparing your SQMU tokens. Reply with your wallet details for assistance.';
    }
    MailApp.sendEmail(email, 'SQMU Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
