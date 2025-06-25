function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput('Missing POST data');
  }
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log('Received: ' + e.postData.contents);
    var body = 'Thank you for your payment.\n' +
      'Transaction: ' + data.tx_link + '\n' +
      'Amount: ' + data.usd + ' USD paid in ' + data.token + ' on ' + data.chain + '.';
    MailApp.sendEmail(data.to_email, 'SQMU Receipt', body);
    return ContentService.createTextOutput('OK');
  } catch(err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
