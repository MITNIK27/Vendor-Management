/**
 * FormHandler.gs
 * Phase 3: builds/owns the Delivery Manager review Form and processes its
 * submissions. The Form has no linked response spreadsheet — onFormSubmit
 * fires as an installable trigger carrying the response in the event
 * object, and processFormResponse_ writes into Review Responses itself via
 * SheetService, exactly like every other write in this project.
 */

var REVIEW_FORM_TITLE = 'Subcontractor Review — 3/6/9 Month Assessment';

/**
 * Fixed question list for the review Form. Kept as data so
 * ensureReviewForm() and Tests.gs can both reference the same canonical
 * schema — the Form's shape can never silently drift from what
 * processFormResponse_ expects.
 */
var REVIEW_FORM_QUESTIONS = [
  { title: 'Resource ID', type: 'text', description: 'Pre-filled automatically — please do not change.' },
  { title: 'Milestone', type: 'text', description: 'Pre-filled automatically — please do not change.' },
  { title: 'Current Requirement', type: 'paragraph', description: 'Is there still an active business requirement for this resource?' },
  { title: 'Expected Duration', type: 'choice', options: ['Short-term (under 3 months)', 'Medium-term (3-6 months)', 'Long-term (6+ months)'] },
  { title: 'Business Dependency', type: 'choice', options: ['Low', 'Medium', 'High'] },
  { title: 'Internal Replacement Possible', type: 'choice', options: ['Yes', 'No', 'Unsure'] },
  { title: 'Cross-Training Opportunity', type: 'choice', options: ['Yes', 'No'] },
  { title: 'FTE Conversion Potential', type: 'choice', options: ['Yes', 'No', 'Maybe'] },
  { title: 'Replacement Timeline', type: 'choice', options: ['Immediate', '1-3 months', '3-6 months', 'Not applicable'] },
  { title: 'Comments', type: 'paragraph', description: 'Optional — anything else worth noting.', required: false }
];

/**
 * Returns the review Form, creating it (with the exact structure above) if
 * Config's System.ReviewFormId is unset or no longer resolves. Idempotent —
 * safe to call on every link-build.
 * @return {Form}
 */
function ensureReviewForm() {
  var formId = getConfigValue('System', 'ReviewFormId');
  if (formId) {
    try {
      return FormApp.openById(formId);
    } catch (e) {
      console.warn('Stored ReviewFormId no longer resolves, recreating: ' + e.message);
    }
  }

  var form = FormApp.create(REVIEW_FORM_TITLE);
  form.setDescription('Please complete this review for the subcontractor named above. Submitting this form updates their record automatically.');
  REVIEW_FORM_QUESTIONS.forEach(function (q) {
    var item;
    if (q.type === 'text') {
      item = form.addTextItem();
    } else if (q.type === 'paragraph') {
      item = form.addParagraphTextItem();
    } else {
      item = form.addMultipleChoiceItem();
      item.setChoiceValues(q.options);
    }
    item.setTitle(q.title);
    if (q.description) item.setHelpText(q.description);
    item.setRequired(q.required !== false);
  });

  setConfigValue('System', 'ReviewFormId', form.getId(), 'Auto-created by ensureReviewForm()');
  setConfigValue('System', 'ReviewFormUrl', form.getPublishedUrl(), 'Public URL of the review form — DMs get a pre-filled link instead, this is for reference');
  return form;
}

/**
 * Returns the Form item with the given title, or null if not found.
 * @param {Form} form
 * @param {string} title
 * @return {Item|null}
 * @private
 */
function getReviewFormItem_(form, title) {
  var items = form.getItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

/**
 * Returns a pre-filled URL to the review Form with Resource ID and
 * Milestone already filled in, so the Delivery Manager only has to answer
 * the actual review questions.
 * @param {string} resourceId
 * @param {string} milestone '3M', '6M', or '9M'
 * @return {string}
 */
function buildReviewFormLink(resourceId, milestone) {
  var form = ensureReviewForm();
  var resourceIdItem = getReviewFormItem_(form, 'Resource ID').asTextItem();
  var milestoneItem = getReviewFormItem_(form, 'Milestone').asTextItem();
  return form.createResponse()
    .withItemResponse(resourceIdItem.createResponse(resourceId))
    .withItemResponse(milestoneItem.createResponse(milestone))
    .toPrefilledUrl();
}

/**
 * The actual logic behind a form submission, kept pure and directly
 * testable (no event object) — mirrors Monitoring.gs's process*_ pattern.
 * Never throws: an unknown Resource ID is an expected, handled condition
 * (a DM likely mistyped it), logged as a Warning, not an Error.
 * @param {Object<string,string>} data plain object keyed by question title
 * @return {void}
 */
function processFormResponse_(data) {
  var resourceId = data['Resource ID'];
  var milestone = data['Milestone'];
  var resource = getResourceById(resourceId);
  if (!resource) {
    logFailure_('Form response', resourceId || '(blank)', '', 'Unknown Resource ID', 'Warning');
    return;
  }

  appendRecord(REVIEW_RESPONSES_SHEET, {
    'Resource ID': resourceId,
    'Current Requirement': data['Current Requirement'] || '',
    'Expected Duration': data['Expected Duration'] || '',
    'Business Dependency': data['Business Dependency'] || '',
    'Internal Replacement Possible': data['Internal Replacement Possible'] || '',
    'Cross-Training Opportunity': data['Cross-Training Opportunity'] || '',
    'FTE Conversion Potential': data['FTE Conversion Potential'] || '',
    'Replacement Timeline': data['Replacement Timeline'] || '',
    'Comments': data['Comments'] || '',
    'Submitted At': new Date()
  });

  var isLongTerm = data['Expected Duration'] === getConfigValue('Thresholds', 'LongTermDurationValue');
  var updates = {
    'Long-Term Dependency': isLongTerm ? 'Yes' : 'No',
    'Cross-Training Candidate': data['Cross-Training Opportunity'] || '',
    'FTE Conversion Candidate': data['FTE Conversion Potential'] || ''
  };
  if (['3M', '6M', '9M'].indexOf(milestone) !== -1) {
    updates[milestone + ' Review Status'] = 'Completed';
  }
  updateResource(resourceId, updates);

  closeAction('Resource ID', resourceId, 'Review ' + milestone);

  if (isLongTerm) {
    createAction({
      'Resource ID': resourceId, 'Type': 'FTE/Cross-Train Evaluation', 'Priority': 'Medium',
      'Owner': getOwnerEmail() || '', 'Due Date': addDays_(new Date(), 14)
    });
  }
}

/**
 * The installed onFormSubmit trigger entry point. Thin by design: extracts
 * the response into a plain object and delegates to processFormResponse_
 * under a script lock (a form submission can land while the daily scan is
 * running). Never lets an unexpected error escape as an unhandled trigger
 * exception — logs it to Failures instead.
 * @param {Object} e the form-submit trigger event
 * @return {void}
 */
function onFormSubmitHandler(e) {
  var data = {};
  try {
    e.response.getItemResponses().forEach(function (itemResponse) {
      data[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
    });
  } catch (parseErr) {
    logFailure_('Form submission', '(unknown)', '', 'Could not parse form response: ' + parseErr.message, 'Error');
    return;
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    logFailure_('Form submission', data['Resource ID'] || '(unknown)', '', 'Could not acquire lock: ' + lockErr.message, 'Error');
    return;
  }
  try {
    processFormResponse_(data);
  } catch (err) {
    logFailure_('Form submission', data['Resource ID'] || '(unknown)', '', err.message, 'Error');
  } finally {
    lock.releaseLock();
  }
}
