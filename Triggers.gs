/**
 * Triggers.gs
 * The only place that creates/deletes time- and form-based triggers.
 * ensureDailyTrigger is idempotent (checks for an existing trigger before
 * creating one) but is still a deliberate, manual, run-once-during-setup
 * step — nothing else in this codebase calls it automatically, since
 * running it starts real recurring automation on the owner's account.
 */

/**
 * Ensures exactly one daily time-based trigger exists for
 * runDailyMonitoringScan, creating it (at 7am in the manifest's timezone)
 * only if no such trigger already exists. Run this manually once, when
 * ready to go live — never called by any other function in this project.
 * @return {void}
 */
function ensureDailyTrigger() {
  var existing = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'runDailyMonitoringScan';
  });
  if (existing) {
    console.log('A trigger for runDailyMonitoringScan already exists — not creating another.');
    return;
  }
  ScriptApp.newTrigger('runDailyMonitoringScan').timeBased().atHour(7).everyDays(1).create();
  console.log('Created a daily trigger for runDailyMonitoringScan at 7am.');
}

/**
 * Ensures exactly one form-submit trigger exists for onFormSubmitHandler,
 * bound to the review Form (created via ensureReviewForm if it doesn't
 * exist yet), creating the trigger only if no such trigger already
 * exists. Run this manually once, when ready to go live — never called by
 * any other function in this project.
 * @return {void}
 */
function ensureFormSubmitTrigger() {
  var form = ensureReviewForm();
  var existing = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'onFormSubmitHandler';
  });
  if (existing) {
    console.log('A trigger for onFormSubmitHandler already exists — not creating another.');
    return;
  }
  ScriptApp.newTrigger('onFormSubmitHandler').forForm(form).onFormSubmit().create();
  console.log('Created a form-submit trigger for onFormSubmitHandler.');
}

/**
 * Deletes every trigger on this project. Manual utility for resetting
 * trigger setup — not called by anything else.
 * @return {void}
 */
function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  console.log('Removed ' + triggers.length + ' trigger(s).');
}
