// listing_email_receipt.gs - send SQMU listing purchase receipts
function doPost(e) {
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const token = e.parameter.token;
    const chain = e.parameter.chain;
    const prop = e.parameter.prop;
    const sqmu = e.parameter.sqmu_amt;
    const agent = e.parameter.agent;
    if (!(email && txLink && usd && token && chain)) {
      throw new Error('Missing fields');
    }
    let body = 'Thank you for purchasing SQMU.\n' +
      'Transaction: ' + txLink + '\n' +
      'Amount: ' + usd + ' ' + token + ' on ' + chain + '.';
    if (prop) body += '\nProperty code: ' + prop;
    if (sqmu) body += '\nSQMU amount: ' + sqmu;
    if (agent) body += '\nAgent code: ' + agent;
    MailApp.sendEmail(email, 'SQMU Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
