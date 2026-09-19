/**
 * Performance.gs
 * CRUD + lookups for the Performance tab. One row per vendor per review
 * period. Vendor Master's "Performance" column is a rollup of this tab
 * (e.g. latest Quality Score or Overall Status per vendor).
 */

var PERFORMANCE_SHEET = 'Performance';
var PERFORMANCE_HEADERS = [
  'Performance ID', 'Vendor ID', 'Vendor', 'Review Period',
  'Requirements Received', 'Profiles Submitted', 'Interviews', 'Closures',
  'Average TAT (Days)', 'Quality Score', 'Commercial Competitiveness',
  'Overall Status', 'Reviewer Comment'
];

/**
 * Ensures the Performance tab exists with the correct headers.
 * @return {void}
 */
function ensurePerformanceSheet() {
  getOrCreateSheet(PERFORMANCE_SHEET, PERFORMANCE_HEADERS);
}

/**
 * Returns every performance record.
 * @return {Array<Object>}
 */
function getAllPerformanceRecords() {
  return getAllRecords(PERFORMANCE_SHEET);
}

/**
 * Returns every performance record for the given Vendor ID.
 * @param {string} vendorId
 * @return {Array<Object>}
 */
function getPerformanceByVendor(vendorId) {
  return findRecords(PERFORMANCE_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new performance record.
 * @param {Object} record keyed by Performance column names
 * @return {number} the sheet row the record was written to
 */
function createPerformanceRecord(record) {
  return appendRecord(PERFORMANCE_SHEET, record);
}
