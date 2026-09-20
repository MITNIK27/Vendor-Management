/**
 * EmailService.gs
 * All MailApp calls, template rendering from Config, and send-failure
 * logging. This is the only file that calls MailApp — Monitoring.gs and
 * everything else send email only through sendTemplatedEmail.
 */

var FAILURES_SHEET = 'Failures';
var FAILURES_HEADERS = ['Timestamp', 'Context', 'Entity ID', 'Recipient', 'Error Message', 'Severity'];

/**
 * Ensures the Failures tab exists with the correct headers.
 * @return {void}
 */
function ensureFailuresSheet() {
  getOrCreateSheet(FAILURES_SHEET, FAILURES_HEADERS);
}

/**
 * Writes a row to the Failures tab so a failed or skipped send is never
 * silently lost. severity is 'Warning' for expected/handled conditions
 * (e.g. no email on file) or 'Error' for anything unexpected.
 * @param {string} context short label for what was being attempted, e.g. 'Review 3M'
 * @param {string} entityId Resource ID or Vendor ID this failure relates to
 * @param {string} recipient the intended recipient, or '' if none
 * @param {string} errorMessage
 * @param {string} severity 'Warning' or 'Error'
 * @return {void}
 */
function logFailure_(context, entityId, recipient, errorMessage, severity) {
  ensureFailuresSheet();
  var log = severity === 'Warning' ? console.warn : console.error;
  log(severity + ': ' + context + ' (' + entityId + ') -> ' + recipient + ': ' + errorMessage);
  appendRecord(FAILURES_SHEET, {
    'Timestamp': new Date(), 'Context': context, 'Entity ID': entityId,
    'Recipient': recipient || '', 'Error Message': errorMessage, 'Severity': severity
  });
}

/**
 * Substitutes {{Key}} placeholders in a template body with values from
 * placeholders (missing keys are left as-is rather than blanked out, so a
 * malformed template is obvious instead of silently losing text).
 * @param {string} template
 * @param {Object<string,string>} placeholders
 * @return {string}
 */
function renderTemplate_(template, placeholders) {
  return template.replace(/\{\{(\w[\w ]*)\}\}/g, function (match, key) {
    return placeholders.hasOwnProperty(key) ? String(placeholders[key]) : match;
  });
}

/**
 * Renders and sends (or, in dry-run mode, logs) a templated email. Never
 * throws — every failure path logs to the Failures tab and returns false
 * so a calling loop can continue to the next item.
 * @param {string} to recipient email address; '' / null is treated as an
 *   expected, handled condition (e.g. resource has no DM on file), not an error
 * @param {string} templateName Config.EmailTemplates key, e.g. 'MilestoneReview'
 * @param {Object<string,string>} placeholders values to substitute into the template
 * @param {string} context short label for logging, e.g. 'Review 3M for RES-0001'
 * @param {string} entityId Resource ID or Vendor ID this email relates to
 * @return {boolean} true if sent (or simulated in dry-run mode), false otherwise
 */
function sendTemplatedEmail(to, templateName, placeholders, context, entityId) {
  if (!to) {
    logFailure_(context, entityId, '', 'No recipient email on file', 'Warning');
    return false;
  }

  var template = getEmailTemplate(templateName);
  if (!template) {
    logFailure_(context, entityId, to, 'No email template configured for "' + templateName + '"', 'Error');
    return false;
  }

  var body = renderTemplate_(template, placeholders);
  var subject = '[Vendor Workforce System] ' + context;

  if (isDryRunMode()) {
    console.log('DRY RUN - would send to ' + to + ' subject="' + subject + '"\n' + body);
    return true;
  }

  if (MailApp.getRemainingDailyQuota() <= 0) {
    logFailure_(context, entityId, to, 'Daily MailApp quota exhausted', 'Error');
    return false;
  }

  try {
    MailApp.sendEmail(to, subject, body);
    return true;
  } catch (e) {
    logFailure_(context, entityId, to, e.message, 'Error');
    return false;
  }
}
