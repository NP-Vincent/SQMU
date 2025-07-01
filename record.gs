function doPost(e) {
  const ss = SpreadsheetApp.openById('1k5EjrpY3d1_pJvexZ6hztmDIB1wJQg0uNnds4lhm3Gs');
  const agentSheet = ss.getSheetByName('Agents');
  const propSheet = ss.getSheetByName('Properties');
  if (e && e.parameter) {
    // Property registration
    const property = e.parameter.property;
    const tokenId = e.parameter.token_id;
    const tokenAddr = e.parameter.token_addr;
    if (property && tokenId && tokenAddr && propSheet) {
      propSheet.appendRow([new Date(), property, tokenId, tokenAddr]);
      return ContentService.createTextOutput('OK');
    }

    // Agent registration
    const name = e.parameter.name;
    const email = e.parameter.email;
    const wallet = e.parameter.wallet;
    const code = e.parameter.code;
    const prop = e.parameter.prop;
    if (name && email && wallet && code && agentSheet) {
      agentSheet.appendRow([new Date(), name, email, wallet, code, prop || '']);
      return ContentService.createTextOutput('OK');
    }
  }
  return ContentService.createTextOutput('Missing field');
}
