/**
 * Config.gs
 * Reads/writes the Config tab. No business logic lives here — this file
 * only exposes tunable values (thresholds, DM directory, email templates,
 * enum vocab) so the rest of the system never hardcodes them.
 *
 * Config tab layout: one row per setting, grouped by Section.
 *   Section | Key | Value | Notes
 * e.g. Section="Thresholds", Key="SOWExpiryWindowDays1", Value="30"
 *      Section="DMDirectory", Key="Priya Patel", Value="priya@example.com"
 *      Section="EnumVocab", Key="Vendor Master.MSA Status", Value="Active,Pending Renewal,Not Available"
 */

var CONFIG_SHEET = 'Config';
var CONFIG_HEADERS = ['Section', 'Key', 'Value', 'Notes'];

/**
 * Ensures the Config tab exists with the correct headers.
 * @return {void}
 */
function ensureConfigSheet() {
  getOrCreateSheet(CONFIG_SHEET, CONFIG_HEADERS);
}

/**
 * Returns the Value for a given Section+Key, or null if not set.
 * @param {string} section
 * @param {string} key
 * @return {string|null}
 */
function getConfigValue(section, key) {
  var record = findRecord(CONFIG_SHEET, function (r) {
    return r.Section === section && r.Key === key;
  });
  return record ? record.Value : null;
}

/**
 * Returns every {key, value, notes} entry under a Section.
 * @param {string} section
 * @return {Array<{key: string, value: string, notes: string}>}
 */
function getConfigSection(section) {
  return findRecords(CONFIG_SHEET, function (r) {
    return r.Section === section;
  }).map(function (r) {
    return { key: r.Key, value: r.Value, notes: r.Notes };
  });
}

/**
 * Creates or overwrites a single Config entry.
 * @param {string} section
 * @param {string} key
 * @param {string} value
 * @param {string=} notes
 * @return {void}
 */
function setConfigValue(section, key, value, notes) {
  var updated = updateRecord(
    CONFIG_SHEET,
    function (r) { return r.Section === section && r.Key === key; },
    { Value: value, Notes: notes || '' }
  );
  if (!updated) {
    appendRecord(CONFIG_SHEET, { Section: section, Key: key, Value: value, Notes: notes || '' });
  }
}

/**
 * Returns the email address for a named Delivery Manager, or null if the
 * DM directory has no entry for that name.
 * @param {string} dmName
 * @return {string|null}
 */
function getDeliveryManagerEmail(dmName) {
  return getConfigValue('DMDirectory', dmName);
}

/**
 * Returns a numeric threshold from Config (e.g. SOW expiry alert window in
 * days), or the given default if not set / not a valid number.
 * @param {string} key
 * @param {number} defaultValue
 * @return {number}
 */
function getThresholdNumber(key, defaultValue) {
  var raw = getConfigValue('Thresholds', key);
  var num = Number(raw);
  return raw !== null && !isNaN(num) ? num : defaultValue;
}

/**
 * Returns an email template body by name (placeholders like {{ResourceName}}
 * are substituted by EmailService, not here), or null if not set.
 * @param {string} templateName
 * @return {string|null}
 */
function getEmailTemplate(templateName) {
  return getConfigValue('EmailTemplates', templateName);
}

/**
 * Returns the allowed values for an enum-style field as an array, or an
 * empty array if not configured. fieldPath is e.g. "Vendor Master.MSA Status".
 * @param {string} fieldPath
 * @return {Array<string>}
 */
function getEnumVocab(fieldPath) {
  var raw = getConfigValue('EnumVocab', fieldPath);
  if (!raw) return [];
  return raw.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
}

/**
 * Reverse lookup: returns the Delivery Manager name whose DMDirectory
 * entry matches the given email, or the email itself if no match is found
 * (so callers always have something displayable in a template).
 * @param {string} email
 * @return {string}
 */
function getDeliveryManagerNameByEmail(email) {
  if (!email) return '';
  var entry = findRecord(CONFIG_SHEET, function (r) {
    return r.Section === 'DMDirectory' && r.Value === email;
  });
  return entry ? entry.Key : email;
}

/**
 * Returns the system owner's (Akanksha's) email address, used as the
 * recipient for vendor-level actions that have no per-vendor internal
 * owner in the schema. Returns null if not configured.
 * @return {string|null}
 */
function getOwnerEmail() {
  return getConfigValue('System', 'OwnerEmail');
}

/**
 * Returns the system owner's (Akanksha's) display name. Returns null if
 * not configured.
 * @return {string|null}
 */
function getOwnerName() {
  return getConfigValue('System', 'OwnerName');
}

/**
 * Returns true if EmailService should log emails instead of sending them
 * (dry-run mode), per the "System.DryRunMode" Config entry. Defaults to
 * true (safe) if not set.
 * @return {boolean}
 */
function isDryRunMode() {
  var raw = getConfigValue('System', 'DryRunMode');
  if (raw === null) return true;
  return String(raw).toLowerCase() === 'true';
}
