/**
 * ContractSow.gs
 * CRUD + lookups for the Contracts & SOW tab. One row per contract
 * document (typically MSA + SOW per vendor). This is the authoritative
 * per-document history with its own Effective/Expiry dates — Vendor
 * Master's MSA Status/SOW Status columns are a current-state rollup of
 * this tab.
 */

var CONTRACT_SOW_SHEET = 'Contracts & SOW';
var CONTRACT_SOW_HEADERS = [
  'Contract ID', 'Vendor ID', 'Vendor', 'Document Type', 'Document Status',
  'Effective Date', 'Expiry Date', 'Commercial %', 'Payment Terms',
  'Conversion Terms', 'Renewal Required', 'Key Clause / Note'
];

/**
 * Ensures the Contracts & SOW tab exists with the correct headers.
 * @return {void}
 */
function ensureContractSowSheet() {
  getOrCreateSheet(CONTRACT_SOW_SHEET, CONTRACT_SOW_HEADERS);
}

/**
 * Returns every contract record.
 * @return {Array<Object>}
 */
function getAllContracts() {
  return getAllRecords(CONTRACT_SOW_SHEET);
}

/**
 * Returns every contract record for the given Vendor ID.
 * @param {string} vendorId
 * @return {Array<Object>}
 */
function getContractsByVendor(vendorId) {
  return findRecords(CONTRACT_SOW_SHEET, function (r) { return r['Vendor ID'] === vendorId; });
}

/**
 * Appends a new contract record.
 * @param {Object} record keyed by Contracts & SOW column names
 * @return {number} the sheet row the record was written to
 */
function createContract(record) {
  return appendRecord(CONTRACT_SOW_SHEET, record);
}

/**
 * Appends many contract records in a single write — use for bulk loading
 * instead of calling createContract in a loop.
 * @param {Array<Object>} records
 * @return {void}
 */
function createContracts(records) {
  appendRecords(CONTRACT_SOW_SHEET, records);
}

/**
 * Merges updates into the contract record with the given Contract ID.
 * @param {string} contractId
 * @param {Object} updates
 * @return {boolean} true if the contract was found and updated
 */
function updateContract(contractId, updates) {
  return updateRecord(CONTRACT_SOW_SHEET, function (r) { return r['Contract ID'] === contractId; }, updates);
}
