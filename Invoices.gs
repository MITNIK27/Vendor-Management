/**
 * Invoices.gs
 * CRUD + lookups for the Invoices tab. One row per vendor invoice per
 * month. This is the source of truth for expected-vs-actual billing —
 * Phase 4's variance detection (InvoiceCheck.gs) reads and flags rows here.
 */

var INVOICES_SHEET = 'Invoices';
var INVOICES_HEADERS = [
  'Invoice ID', 'Vendor ID', 'Vendor', 'Invoice Month', 'Invoice Date',
  'Expected Amount', 'Vendor Invoice Amount', 'Variance', 'Variance %',
  'Validation Status', 'Issue Type', 'Action', 'Finance Submission'
];

/**
 * Ensures the Invoices tab exists with the correct headers.
 * @return {void}
 */
function ensureInvoicesSheet() {
  getOrCreateSheet(INVOICES_SHEET, INVOICES_HEADERS);
}

/**
 * Returns every invoice record.
 * @return {Array<Object>}
 */
function getAllInvoices() {
  return getAllRecords(INVOICES_SHEET);
}

/**
 * Returns every invoice record for the given Vendor ID.
 * @param {string} vendorId
 * @return {Array<Object>}
 */
function getInvoicesByVendor(vendorId) {
  return findRecords(INVOICES_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new invoice record.
 * @param {Object} record keyed by Invoices column names
 * @return {number} the sheet row the record was written to
 */
function createInvoice(record) {
  return appendRecord(INVOICES_SHEET, record);
}

/**
 * Merges updates into the invoice record with the given Invoice ID.
 * @param {string} invoiceId
 * @param {Object} updates
 * @return {boolean} true if the invoice was found and updated
 */
function updateInvoice(invoiceId, updates) {
  return updateRecord(INVOICES_SHEET, function (r) { return r['Invoice ID'] === invoiceId; }, updates);
}
