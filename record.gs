function doPost(e) {
  const sheet = SpreadsheetApp.openById('1k5EjrpY3d1_pJvexZ6hztmDIB1wJQg0uNnds4lhm3Gs').getSheetByName('Agents');
  if (e && e.parameter) {
    const name = e.parameter.name;
    const email = e.parameter.email;
    const wallet = e.parameter.wallet;
    const code = e.parameter.code;
    const prop = e.parameter.prop;
    if (name && email && wallet && code) {
      sheet.appendRow([new Date(), name, email, wallet, code, prop || '']);
      return ContentService.createTextOutput('OK');
    }
  }
  return ContentService.createTextOutput('Missing field');
}
