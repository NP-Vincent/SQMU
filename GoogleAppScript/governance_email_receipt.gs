// governance_email_receipt.gs - send governance token purchase receipts
function doPost(e) {
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const token = e.parameter.token;
    const chain = e.parameter.chain;
    const amount = e.parameter.gov_amount;
    if (!(email && txLink && usd && token && chain && amount)) {
      throw new Error('Missing fields');
    }
    let body = 'Thank you for your governance token purchase.\n' +
      'Transaction: ' + txLink + '\n' +
      'Amount paid: ' + usd + ' ' + token + ' on ' + chain + '\n' +
      'Governance tokens: ' + amount;
    MailApp.sendEmail(email, 'Governance Token Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
