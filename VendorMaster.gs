/**
 * VendorMaster.gs
 * CRUD + lookups for the Vendor Master tab. One row per vendor. This is a
 * compliance/commercial rollup view — the authoritative per-document (MSA,
 * SOW) history with its own dates lives in Contracts & SOW; MSA Status/
 * SOW Status/NDA/Due Diligence here reflect the current state for quick
 * reference. Active Resources, Monthly Billing, Performance, and Savings
 * are rollups of Resource Master, Invoices, Performance, and Savings
 * respectively.
 */

var VENDOR_MASTER_SHEET = 'Vendor Master';
var VENDOR_MASTER_HEADERS = [
  'Vendor ID', 'Vendor', 'Category', 'Type', 'Skills', 'Geography', 'SPOC',
  'MSA Status', 'SOW Status', 'NDA', 'Due Diligence', 'Commercial %',
  'Payment Terms', 'Conversion Terms', 'Active Resources', 'Monthly Billing',
  'Performance', 'Savings', 'Status'
];

/**
 * Ensures the Vendor Master tab exists with the correct headers.
 * @return {void}
 */
function ensureVendorMasterSheet() {
  getOrCreateSheet(VENDOR_MASTER_SHEET, VENDOR_MASTER_HEADERS);
}

/**
 * Returns every vendor record.
 * @return {Array<Object>}
 */
function getAllVendors() {
  return getAllRecords(VENDOR_MASTER_SHEET);
}

/**
 * Returns the vendor record with the given Vendor ID, or null if not found.
 * @param {string} vendorId
 * @return {Object|null}
 */
function getVendorById(vendorId) {
  return findRecord(VENDOR_MASTER_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new vendor record.
 * @param {Object} record keyed by Vendor Master column names
 * @return {number} the sheet row the record was written to
 */
function createVendor(record) {
  return appendRecord(VENDOR_MASTER_SHEET, record);
}

/**
 * Appends many vendor records in a single write — use for bulk loading
 * (mock data generation, or a future real-data import) instead of calling
 * createVendor in a loop.
 * @param {Array<Object>} records
 * @return {void}
 */
function createVendors(records) {
  appendRecords(VENDOR_MASTER_SHEET, records);
}

/**
 * Merges updates into the vendor record with the given Vendor ID.
 * @param {string} vendorId
 * @param {Object} updates
 * @return {boolean} true if the vendor was found and updated
 */
function updateVendor(vendorId, updates) {
  return updateRecord(VENDOR_MASTER_SHEET, function (r) { return r['Vendor ID'] === vendorId; }, updates);
}
