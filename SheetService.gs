/**
 * SheetService.gs
 * Thin wrapper around SpreadsheetApp. Every other file reads/writes sheet
 * data through the functions here — no other file calls SpreadsheetApp
 * directly. This is what makes a future migration (Sheets -> real database)
 * a change in one file instead of everywhere.
 *
 * Data convention: a "record" is a plain object keyed by header name, e.g.
 * {Vendor: "Acme", Status: "Active"}. Records returned by read functions
 * carry an extra "_row" property (1-based sheet row number, header row is
 * row 1) so callers can pass it back to updateRecordAtRow without a second
 * lookup.
 */

/**
 * Returns the spreadsheet this script is bound to.
 * @return {Spreadsheet}
 */
function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Strips a leading =, +, -, or @ from a string value so it can never be
 * interpreted as a formula when written into a cell. Non-string values are
 * returned unchanged.
 * @param {*} value
 * @return {*}
 */
function sanitizeCellValue_(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Gets the sheet with the given name, creating it (with the given header
 * row) if it does not exist yet. If the sheet exists but has no header row,
 * the header row is written. If the sheet has a header row that doesn't
 * match the expected headers but has no data rows yet (safe — nothing to
 * lose), the header row is rewritten to match, so a schema change picked
 * up by code (e.g. a new column) doesn't silently get ignored on a sheet
 * left over from before the change. A header mismatch on a sheet that
 * already has data rows is left alone — that needs a deliberate migration,
 * not a silent overwrite.
 * @param {string} sheetName
 * @param {Array<string>} headers
 * @return {Sheet}
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 1) {
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(headers)) {
      sheet.getRange(1, 1, 1, sheet.getLastColumn()).clearContent();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

/**
 * Returns the header row of the given sheet as an array of strings.
 * @param {string} sheetName
 * @return {Array<string>}
 */
function getHeaders(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * Reads every data row (everything below the header) as an array of record
 * objects keyed by header name, each carrying its 1-based sheet row number
 * in "_row".
 * @param {string} sheetName
 * @return {Array<Object>}
 */
function getAllRecords(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getHeaders(sheetName);
  var numRows = sheet.getLastRow() - 1;
  var values = sheet.getRange(2, 1, numRows, headers.length).getValues();
  var records = [];
  for (var i = 0; i < values.length; i++) {
    var record = { _row: i + 2 };
    for (var c = 0; c < headers.length; c++) {
      record[headers[c]] = values[i][c];
    }
    records.push(record);
  }
  return records;
}

/**
 * Returns the record at the given 1-based sheet row, or null if that row
 * is the header row or beyond the last row.
 * @param {string} sheetName
 * @param {number} rowNumber
 * @return {Object|null}
 */
function getRecordAtRow(sheetName, rowNumber) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || rowNumber < 2 || rowNumber > sheet.getLastRow()) return null;
  var headers = getHeaders(sheetName);
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var record = { _row: rowNumber };
  for (var c = 0; c < headers.length; c++) {
    record[headers[c]] = values[c];
  }
  return record;
}

/**
 * Builds one row of cell values from a record, in header order, sanitized
 * against formula injection. Shared by appendRecord and appendRecords so
 * both stay consistent.
 * @param {Array<string>} headers
 * @param {Object} record
 * @return {Array<*>}
 * @private
 */
function buildRow_(headers, record) {
  return headers.map(function (h) {
    return sanitizeCellValue_(record[h] !== undefined ? record[h] : '');
  });
}

/**
 * Appends a new record. Fields not present in the record are left blank.
 * Fields present in the record but not in the sheet's headers are ignored.
 * String values are sanitized against formula injection.
 * @param {string} sheetName
 * @param {Object} record
 * @return {number} the 1-based sheet row number the record was written to
 */
function appendRecord(sheetName, record) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  var headers = getHeaders(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([buildRow_(headers, record)]);
  return sheet.getLastRow();
}

/**
 * Appends many records in a single write — use this instead of calling
 * appendRecord in a loop whenever writing more than a couple of rows
 * (e.g. bulk mock-data generation, or a future real-data import); it's
 * the same per-row shape as appendRecord, just issued as one Sheets API
 * call instead of one per row.
 * @param {string} sheetName
 * @param {Array<Object>} records
 * @return {void}
 */
function appendRecords(sheetName, records) {
  if (!records || records.length === 0) return;
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  var headers = getHeaders(sheetName);
  var rows = records.map(function (record) { return buildRow_(headers, record); });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

/**
 * Merges the given updates into the record at the given 1-based sheet row.
 * Only columns present in updates are touched; everything else is left
 * as-is. String values are sanitized against formula injection.
 * @param {string} sheetName
 * @param {number} rowNumber
 * @param {Object} updates
 * @return {void}
 */
function updateRecordAtRow(sheetName, rowNumber, updates) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  var headers = getHeaders(sheetName);
  Object.keys(updates).forEach(function (key) {
    var colIndex = headers.indexOf(key);
    if (colIndex === -1) return;
    sheet.getRange(rowNumber, colIndex + 1).setValue(sanitizeCellValue_(updates[key]));
  });
}

/**
 * Finds the first record for which predicateFn returns true.
 * @param {string} sheetName
 * @param {function(Object): boolean} predicateFn
 * @return {Object|null}
 */
function findRecord(sheetName, predicateFn) {
  var records = getAllRecords(sheetName);
  for (var i = 0; i < records.length; i++) {
    if (predicateFn(records[i])) return records[i];
  }
  return null;
}

/**
 * Finds every record for which predicateFn returns true.
 * @param {string} sheetName
 * @param {function(Object): boolean} predicateFn
 * @return {Array<Object>}
 */
function findRecords(sheetName, predicateFn) {
  return getAllRecords(sheetName).filter(predicateFn);
}

/**
 * Updates the first record matching predicateFn with the given updates.
 * @param {string} sheetName
 * @param {function(Object): boolean} predicateFn
 * @param {Object} updates
 * @return {boolean} true if a matching record was found and updated
 */
function updateRecord(sheetName, predicateFn, updates) {
  var record = findRecord(sheetName, predicateFn);
  if (!record) return false;
  updateRecordAtRow(sheetName, record._row, updates);
  return true;
}

/**
 * Clears every data row below the header (content only, not the rows
 * themselves), leaving the header row and the sheet's row count intact.
 * Used by MockData.gs to regenerate mock data idempotently. Deliberately
 * uses clearContent rather than deleteRows: deleteRows can fail with
 * "Sorry, it is not possible to delete all non-frozen rows" when a
 * sheet's grid happens to have no spare rows below its data (so deleting
 * every data row would delete every non-frozen row in the whole sheet) —
 * clearing content instead sidesteps that Sheets-level restriction
 * entirely, since the row structure never changes.
 * @param {string} sheetName
 * @return {void}
 */
function clearSheetRows(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
}
