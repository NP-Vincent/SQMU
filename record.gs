function doPost(e) {
  const ss = SpreadsheetApp.openById('1k5EjrpY3d1_pJvexZ6hztmDIB1wJQg0uNnds4lhm3Gs');
  const agentSheet = ss.getSheetByName('Agents');
  const propSheet = ss.getSheetByName('Properties');
  if (e && e.parameter) {
    // Property registration
    const property = e.parameter.property;
    const tokenId = e.parameter.token_id;
  const tokenAddr = e.parameter.token_addr;
  const price = e.parameter.price;
  if (property && tokenId && tokenAddr && price && propSheet) {
    propSheet.appendRow([new Date(), property, tokenId, tokenAddr, price]);
    return ContentService.createTextOutput('OK');
  }

    // Agent registration
    const name = e.parameter.name;
    const email = e.parameter.email;
    const wallet = e.parameter.wallet;
  const code = e.parameter.code;
  if (name && email && wallet && code && agentSheet) {
    agentSheet.appendRow([new Date(), name, email, wallet, code]);
      return ContentService.createTextOutput('OK');
    }
  }
  return ContentService.createTextOutput('Missing field');
}
