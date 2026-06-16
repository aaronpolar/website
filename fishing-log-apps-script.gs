/**
 * Aaron's Fishing Log — Google Apps Script Web App
 * Receives POSTs from fishinglog.html and appends a row to the Google Sheet.
 *
 * SETUP
 * 1. Create a Google Sheet named "Aaron's Fishing Log".
 * 2. In the first row (A1:J1), add these exact headers, in this order:
 *      Date | Species | Weight (lbs) | Length (inches) | Location |
 *      Water Type | Bait/Lure Used | Notes | Weather | Time of Day
 * 3. In the Sheet: Extensions > Apps Script. Delete any sample code,
 *    paste this whole file, and Save.
 * 4. Deploy > New deployment > select type "Web app".
 *      - Description: Fishing log
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy, authorize, and copy the "Web app" URL.
 * 5. Paste that URL into fishinglog.html, replacing
 *    REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL.
 *
 * The sheet stays private to your Google account; only this script can
 * write to it, so no credentials ever live in the public website.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var p = (e && e.parameter) || {};
    sheet.appendRow([
      p.date || '',
      p.species || '',
      p.weight || '',
      p.length || '',
      p.location || '',
      p.waterType || '',
      p.bait || '',
      p.notes || '',
      p.weather || '',
      p.timeOfDay || ''
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
