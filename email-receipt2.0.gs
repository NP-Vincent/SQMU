function parseQuery(q) {
  const out = {};
  if (!q) return out;
  const pairs = q.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var kv = pairs[i].split('=');
    var k = decodeURIComponent(kv[0] || '');
    var v = decodeURIComponent(kv[1] || '');
    out[k] = v;
  }
  return out;
}

function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput('Missing POST data');
  }
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const chain = e.parameter.chain;
    const token = e.parameter.token;
    const params = parseQuery(e.postData.contents);
    const tokenAmt = e.parameter.token_amt;
    const tokenId = params.token_id || e.parameter.token_id;
    const sqmuLink = e.parameter.sqmu_link;
    const tokenAddr = params.token_addr || e.parameter.token_addr;
    const fail = e.parameter.fail;
    const prop = e.parameter.prop;
    const sqmuAmt = e.parameter.sqmu_amt;
    const agent = e.parameter.agent;
    if (!(email && txLink && usd && chain && token)) {
      throw new Error('Missing fields');
    }
    let body = 'Thank you for your payment.\n' +
      'Stablecoin tx: ' + txLink + '\n' +
      'Amount: ' + usd + ' USD paid in ' + token + ' on ' + chain + '.';
    if (prop) body += '\nProperty code: ' + prop;
    if (sqmuAmt) body += '\nSQMU amount: ' + sqmuAmt;
    if (agent) body += '\nAgent code: ' + agent;
      if (tokenAmt && tokenId && tokenAddr) {
        body += '\nTokens bought: ' + tokenAmt + ' ' + tokenId +
          '\nToken contract: ' + tokenAddr;
        if (sqmuLink) {
          body += '\nToken purchase tx: ' + sqmuLink;
        }
        body += '\n\nTo view your SQMU tokens:' +
          '\n1. Switch your wallet network to Polygon (chain ID 137).' +
          '\n2. Add a custom token using the address above.' +
          '\n3. Set the token symbol to ' + tokenId + ' and decimals to 2.';
        body += '\nTokens are delivered to the paying wallet within 24 hours.';
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
