// payment_email_receipt.gs - send payment confirmations with Calendly guidance
function doPost(e) {
  try {
    const email = e.parameter.to_email;
    const txLink = e.parameter.tx_link;
    const usd = e.parameter.usd;
    const token = e.parameter.token;
    const chain = e.parameter.chain;
    const calendlyLink = e.parameter.calendly_link || 'https://calendly.com/vincent-sqmu/30min';

    if (!(email && txLink && usd && token && chain)) {
      throw new Error('Missing fields');
    }

    let body = 'Your payment is confirmed.\n' +
      'Transaction: ' + txLink + '\n' +
      'Amount: ' + usd + ' ' + token + ' on ' + chain + '\n\n' +
      'If you have not completed scheduling, please choose your time on Calendly: ' + calendlyLink + '\n' +
      'Instructions: choose an available time slot, enter your email, and submit to receive the Google Meet conference details.';

    body += '\n\nFeel free to reply to this email with any questions or clarifications.';

    MailApp.sendEmail(email, 'Consultation Payment Confirmation', body);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
