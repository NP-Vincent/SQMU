// escrow_email_receipt.gs - send escrow deposit receipts
function doPost(e) {
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const token = e.parameter.token;
    const chain = e.parameter.chain;
    const stage = e.parameter.stage;
    if (!(email && txLink && usd && token && chain && stage)) {
      throw new Error('Missing fields');
    }
    let body = 'Escrow deposit receipt.\n' +
      'Transaction: ' + txLink + '\n' +
      'Amount: ' + usd + ' ' + token + ' on ' + chain + '\n' +
      'Stage: ' + stage;
    MailApp.sendEmail(email, 'Escrow Deposit Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
