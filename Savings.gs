/**
 * Savings.gs
 * CRUD + lookups for the Savings tab. One row per savings event per
 * vendor. Vendor Master's "Savings" column is a rollup of this tab
 * (e.g. sum of Savings for that vendor).
 */

var SAVINGS_SHEET = 'Savings';
var SAVINGS_HEADERS = [
  'Savings ID', 'Vendor ID', 'Vendor', 'Savings Type', 'Original Value',
  'Savings', 'Realized / Potential', 'Date', 'Owner', 'Notes'
];

/**
 * Ensures the Savings tab exists with the correct headers.
 * @return {void}
 */
function ensureSavingsSheet() {
  getOrCreateSheet(SAVINGS_SHEET, SAVINGS_HEADERS);
}

/**
 * Returns every savings record.
 * @return {Array<Object>}
 */
function getAllSavingsRecords() {
  return getAllRecords(SAVINGS_SHEET);
}

/**
 * Returns every savings record for the given Vendor ID.
 * @param {string} vendorId
 * @return {Array<Object>}
 */
function getSavingsByVendor(vendorId) {
  return findRecords(SAVINGS_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new savings record.
 * @param {Object} record keyed by Savings column names
 * @return {number} the sheet row the record was written to
 */
function createSavingsRecord(record) {
  return appendRecord(SAVINGS_SHEET, record);
}
