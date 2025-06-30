function doPost(e) {
  const sheet = SpreadsheetApp.openById('SHEET_ID').getSheetByName('Agents');
  if (e && e.parameter) {
    const name = e.parameter.name;
    const email = e.parameter.email;
    const wallet = e.parameter.wallet;
    const code = e.parameter.code;
    if (name && email && wallet && code) {
      sheet.appendRow([new Date(), name, email, wallet, code]);
      return ContentService.createTextOutput('OK');
    }
  }
  return ContentService.createTextOutput('Missing field');
}
