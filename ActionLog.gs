/**
 * ActionLog.gs
 * Create/close/query actions for the Action Log tab. One row per generated
 * action (SOW Expiry, Review, Invoice Variance). De-dup logic for Phase 2's
 * daily scan lives here (hasOpenAction) so Monitoring.gs never has to touch
 * the sheet directly to check for an existing action.
 */

var ACTION_LOG_SHEET = 'Action Log';
var ACTION_LOG_HEADERS = [
  'Date Created', 'Resource ID', 'Type', 'Priority', 'Owner', 'Due Date',
  'Status', 'Date Closed'
];

/**
 * Ensures the Action Log tab exists with the correct headers.
 * @return {void}
 */
function ensureActionLogSheet() {
  getOrCreateSheet(ACTION_LOG_SHEET, ACTION_LOG_HEADERS);
}

/**
 * Returns every action record.
 * @return {Array<Object>}
 */
function getAllActions() {
  return getAllRecords(ACTION_LOG_SHEET);
}

/**
 * Returns true if there is already an open (Status != Closed) action of
 * the given Type for the given Resource ID. Used by Phase 2's monitoring
 * scan to avoid creating duplicate actions / sending duplicate emails.
 * @param {string} resourceId
 * @param {string} type
 * @return {boolean}
 */
function hasOpenAction(resourceId, type) {
  return findRecord(ACTION_LOG_SHEET, function (r) {
    return r['Resource ID'] === resourceId && r.Type === type && r.Status !== 'Closed';
  }) !== null;
}

/**
 * Creates a new action row with Status "Open" and Date Created set to now
 * (unless overridden in record).
 * @param {Object} record keyed by Action Log column names (Resource ID,
 *   Type, Priority, Owner, Due Date at minimum)
 * @return {number} the sheet row the record was written to
 */
function createAction(record) {
  var full = Object.assign({
    'Date Created': new Date(),
    'Status': 'Open',
    'Date Closed': ''
  }, record);
  return appendRecord(ACTION_LOG_SHEET, full);
}

/**
 * Closes the open action of the given Type for the given Resource ID, if
 * one exists, setting Status to "Closed" and Date Closed to now.
 * @param {string} resourceId
 * @param {string} type
 * @return {boolean} true if a matching open action was found and closed
 */
function closeAction(resourceId, type) {
  return updateRecord(
    ACTION_LOG_SHEET,
    function (r) { return r['Resource ID'] === resourceId && r.Type === type && r.Status !== 'Closed'; },
    { Status: 'Closed', 'Date Closed': new Date() }
  );
}
