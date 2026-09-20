/**
 * ResourceMaster.gs
 * CRUD + lookups for the Resource Master tab. One row per individual
 * resource. DOJ + the 3M/6M/9M Review Date/Status columns drive Phase 2's
 * milestone detection; SOW End Date drives SOW-expiry detection. Invoice
 * amounts live in the Invoices tab, not here — see Invoices.gs.
 */

var RESOURCE_MASTER_SHEET = 'Resource Master';
var RESOURCE_MASTER_HEADERS = [
  'Resource ID', 'Vendor ID', 'Vendor', 'Candidate Name', 'Tm No.', 'Email ID',
  'Service Type', 'Designation', 'DOJ', 'SOW Start Date', 'SOW End Date',
  'Rate Unit', 'Rates (as per SOW)', 'Skill', 'Client', 'Status', 'Remarks',
  'Delivery Manager Email',
  '3M Review Date', '3M Review Status',
  '6M Review Date', '6M Review Status',
  '9M Review Date', '9M Review Status',
  'Long-Term Dependency', 'Cross-Training Candidate', 'FTE Conversion Candidate',
  'Next Action / Due Date'
];

/**
 * Ensures the Resource Master tab exists with the correct headers.
 * @return {void}
 */
function ensureResourceMasterSheet() {
  getOrCreateSheet(RESOURCE_MASTER_SHEET, RESOURCE_MASTER_HEADERS);
}

/**
 * Returns every resource record.
 * @return {Array<Object>}
 */
function getAllResources() {
  return getAllRecords(RESOURCE_MASTER_SHEET);
}

/**
 * Returns the resource record with the given Resource ID, or null if not found.
 * @param {string} resourceId
 * @return {Object|null}
 */
function getResourceById(resourceId) {
  return findRecord(RESOURCE_MASTER_SHEET, function (r) { return r['Resource ID'] === resourceId; });
}

/**
 * Returns every resource record for the given Vendor ID.
 * @param {string} vendorId
 * @return {Array<Object>}
 */
function getResourcesByVendor(vendorId) {
  return findRecords(RESOURCE_MASTER_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new resource record.
 * @param {Object} record keyed by Resource Master column names
 * @return {number} the sheet row the record was written to
 */
function createResource(record) {
  return appendRecord(RESOURCE_MASTER_SHEET, record);
}

/**
 * Appends many resource records in a single write — use for bulk loading
 * instead of calling createResource in a loop.
 * @param {Array<Object>} records
 * @return {void}
 */
function createResources(records) {
  appendRecords(RESOURCE_MASTER_SHEET, records);
}

/**
 * Merges updates into the resource record with the given Resource ID.
 * @param {string} resourceId
 * @param {Object} updates
 * @return {boolean} true if the resource was found and updated
 */
function updateResource(resourceId, updates) {
  return updateRecord(RESOURCE_MASTER_SHEET, function (r) { return r['Resource ID'] === resourceId; }, updates);
}
