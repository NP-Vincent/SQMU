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
    const prop = e.parameter.prop;
    const reason = e.parameter.reason;
    if (!(email && txLink && usd && chain && token)) {
      throw new Error('Missing fields');
    }
    let body = 'Thank you for your payment.\n' +
      'Transaction: ' + txLink + '\n' +
      'Amount: ' + usd + ' USD paid in ' + token + ' on ' + chain + '.';
    if (prop) body += '\nProperty: ' + prop;
    if (reason) body += '\nReason: ' + reason;
    MailApp.sendEmail(email, 'SQMU Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
