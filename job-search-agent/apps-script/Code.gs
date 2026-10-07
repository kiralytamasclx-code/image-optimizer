// Paste this into your Google Sheet: Extensions > Apps Script.
// Then set TOKEN below to any long random string, and put the same string in
// the GitHub secret SHEET_WEBHOOK_TOKEN. Setup steps are in the README.

const TOKEN = "paste-a-long-random-string-here";
const TAB = "Jobs";
const HEADERS = ["First seen", "Company", "Role", "Seniority", "Location", "Summary", "Posted", "Apply link", "Company LinkedIn", "Status"];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== TOKEN) return ContentService.createTextOutput("error: wrong token");

  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(TAB) || book.insertSheet(TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  if (body.rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, body.rows.length, HEADERS.length).setValues(body.rows);
  }
  return ContentService.createTextOutput("ok " + body.rows.length);
}
