/**
 * Monitoring.gs
 * The daily trigger's scan logic: SOW/contract expiry and 3/6/9-month
 * milestone detection. Calls ActionLog + EmailService only — never touches
 * a sheet directly (SheetService-backed getters/CRUD from ResourceMaster.gs,
 * VendorMaster.gs, ContractSow.gs, ActionLog.gs do that).
 *
 * Expiry windows are threshold ranges, not single-day matches, so a missed
 * trigger day (e.g. the script was paused) still catches up correctly, and
 * an already-expired SOW/contract is naturally covered by the "30d" (urgent)
 * bucket forever rather than silently never firing:
 *   "60d" bucket: 30 < days remaining <= 60  (heads-up)
 *   "30d" bucket: days remaining <= 30       (urgent — includes past expiry)
 * Action Log's dedup (hasOpenAction) is what makes each bucket fire only
 * once per resource/vendor, not the date match itself.
 */

/**
 * Returns true if two Dates fall on the same calendar day, ignoring time
 * of day. Used for milestone detection, which must match "today" exactly.
 * @param {Date} a
 * @param {Date} b
 * @return {boolean}
 */
function sameDay_(a, b) {
  return a instanceof Date && b instanceof Date && a.toDateString() === b.toDateString();
}

/**
 * Returns the whole number of calendar days from a to b (b - a), ignoring
 * time of day.
 * @param {Date} a
 * @param {Date} b
 * @return {number}
 */
function daysBetween_(a, b) {
  var aDate = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  var bDate = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDate.getTime() - aDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Classifies a number of days remaining into an expiry-alert bucket, or
 * null if it's not within either window yet.
 * @param {number} daysRemaining
 * @return {string|null} '30d', '60d', or null
 */
function classifyExpiryTier_(daysRemaining) {
  if (daysRemaining <= 30) return '30d';
  if (daysRemaining <= 60) return '60d';
  return null;
}

/**
 * Formats a date for display inside an email body.
 * @param {Date} date
 * @return {string}
 */
function formatDateForEmail_(date) {
  return date instanceof Date ? date.toDateString() : String(date);
}

/**
 * Returns resources whose 3/6/9-month review milestone date falls exactly
 * on today and whose corresponding review status isn't already Completed
 * (i.e. not already closed out by an actual DM response).
 * @param {Date} today
 * @return {Array<{resource: Object, milestone: number, type: string}>}
 */
function findResourcesAtMilestone(today) {
  var milestones = [
    { months: 3, dateCol: '3M Review Date', statusCol: '3M Review Status', type: 'Review 3M' },
    { months: 6, dateCol: '6M Review Date', statusCol: '6M Review Status', type: 'Review 6M' },
    { months: 9, dateCol: '9M Review Date', statusCol: '9M Review Status', type: 'Review 9M' }
  ];
  var hits = [];
  getAllResources().forEach(function (r) {
    milestones.forEach(function (m) {
      if (r[m.statusCol] !== 'Completed' && sameDay_(r[m.dateCol], today)) {
        hits.push({ resource: r, milestone: m.months, type: m.type });
      }
    });
  });
  return hits;
}

/**
 * Returns resources whose SOW End Date falls within the 60-day or 30-day
 * alert bucket as of today (see file header for bucket definitions).
 * @param {Date} today
 * @return {Array<{resource: Object, daysRemaining: number, tier: string, type: string}>}
 */
function findResourceSowExpiries(today) {
  var hits = [];
  getAllResources().forEach(function (r) {
    if (!(r['SOW End Date'] instanceof Date)) return;
    var daysRemaining = daysBetween_(today, r['SOW End Date']);
    var tier = classifyExpiryTier_(daysRemaining);
    if (!tier) return;
    hits.push({ resource: r, daysRemaining: daysRemaining, tier: tier, type: 'Resource SOW Expiry ' + tier });
  });
  return hits;
}

/**
 * Returns Contracts & SOW rows whose Expiry Date falls within the 60-day
 * or 30-day alert bucket as of today, split by Document Type (MSA vs SOW)
 * so each carries its own Action Log Type string.
 * @param {Date} today
 * @return {Array<{contract: Object, daysRemaining: number, tier: string, type: string}>}
 */
function findVendorContractExpiries(today) {
  var hits = [];
  getAllContracts().forEach(function (c) {
    if (!(c['Expiry Date'] instanceof Date)) return;
    var daysRemaining = daysBetween_(today, c['Expiry Date']);
    var tier = classifyExpiryTier_(daysRemaining);
    if (!tier) return;
    var label = (c['Document Type'] === 'MSA' ? 'Vendor MSA Expiry ' : 'Vendor SOW Expiry ') + tier;
    hits.push({ contract: c, daysRemaining: daysRemaining, tier: tier, type: label });
  });
  return hits;
}

/**
 * Processes every milestone hit for today: dedup, create the Action Log
 * entry, send the DM email. Per-item try/catch so one bad resource never
 * stops the rest of the scan.
 * @param {Date} today
 * @param {Object} counters mutated in place: scanned/created/emailed/failed/skippedDuplicate
 * @return {void}
 */
function processMilestones_(today, counters) {
  findResourcesAtMilestone(today).forEach(function (hit) {
    counters.scanned++;
    var r = hit.resource;
    try {
      if (hasOpenAction('Resource ID', r['Resource ID'], hit.type)) {
        counters.skippedDuplicate++;
        return;
      }
      createAction({
        'Resource ID': r['Resource ID'], 'Type': hit.type, 'Priority': 'Medium',
        'Owner': r['Delivery Manager Email'] || getOwnerEmail() || '', 'Due Date': addDays_(today, 7)
      });
      counters.created++;
      var sent = sendTemplatedEmail(
        r['Delivery Manager Email'], 'MilestoneReview',
        {
          DMName: getDeliveryManagerNameByEmail(r['Delivery Manager Email']),
          CandidateName: r['Candidate Name'], ResourceId: r['Resource ID'],
          Milestone: hit.milestone + '-month', ClientName: r['Client'],
          FormLink: '(Phase 3 form link placeholder)'
        },
        hit.type + ' for ' + r['Resource ID'], r['Resource ID']
      );
      sent ? counters.emailed++ : counters.failed++;
    } catch (e) {
      counters.failed++;
      logFailure_('Milestone scan', r['Resource ID'], '', e.message, 'Error');
    }
  });
}

/**
 * Processes every resource-level SOW expiry hit for today, same pattern as
 * processMilestones_.
 * @param {Date} today
 * @param {Object} counters
 * @return {void}
 */
function processResourceSowExpiries_(today, counters) {
  findResourceSowExpiries(today).forEach(function (hit) {
    counters.scanned++;
    var r = hit.resource;
    try {
      if (hasOpenAction('Resource ID', r['Resource ID'], hit.type)) {
        counters.skippedDuplicate++;
        return;
      }
      createAction({
        'Resource ID': r['Resource ID'], 'Type': hit.type,
        'Priority': hit.tier === '30d' ? 'High' : 'Medium',
        'Owner': r['Delivery Manager Email'] || getOwnerEmail() || '', 'Due Date': r['SOW End Date']
      });
      counters.created++;
      var sent = sendTemplatedEmail(
        r['Delivery Manager Email'], 'SowExpiry',
        {
          DMName: getDeliveryManagerNameByEmail(r['Delivery Manager Email']),
          CandidateName: r['Candidate Name'], ResourceId: r['Resource ID'],
          VendorName: r['Vendor'], SowEndDate: formatDateForEmail_(r['SOW End Date'])
        },
        hit.type + ' for ' + r['Resource ID'], r['Resource ID']
      );
      sent ? counters.emailed++ : counters.failed++;
    } catch (e) {
      counters.failed++;
      logFailure_('Resource SOW expiry scan', r['Resource ID'], '', e.message, 'Error');
    }
  });
}

/**
 * Processes every vendor-level contract expiry hit for today, same
 * pattern as processMilestones_. Emails go to the system owner
 * (Config System.OwnerEmail), since there's no per-vendor internal owner.
 * @param {Date} today
 * @param {Object} counters
 * @return {void}
 */
function processVendorContractExpiries_(today, counters) {
  findVendorContractExpiries(today).forEach(function (hit) {
    counters.scanned++;
    var c = hit.contract;
    try {
      if (hasOpenAction('Vendor ID', c['Vendor ID'], hit.type)) {
        counters.skippedDuplicate++;
        return;
      }
      createAction({
        'Vendor ID': c['Vendor ID'], 'Type': hit.type,
        'Priority': hit.tier === '30d' ? 'High' : 'Medium',
        'Owner': getOwnerEmail() || '', 'Due Date': c['Expiry Date']
      });
      counters.created++;
      var sent = sendTemplatedEmail(
        getOwnerEmail(), 'VendorContractExpiry',
        {
          OwnerName: getOwnerName() || 'Team', VendorName: c['Vendor'], VendorId: c['Vendor ID'],
          DocumentType: c['Document Type'], ExpiryDate: formatDateForEmail_(c['Expiry Date'])
        },
        hit.type + ' for ' + c['Vendor ID'], c['Vendor ID']
      );
      sent ? counters.emailed++ : counters.failed++;
    } catch (e) {
      counters.failed++;
      logFailure_('Vendor contract expiry scan', c['Vendor ID'], '', e.message, 'Error');
    }
  });
}

/**
 * The daily monitoring scan: detects milestones and SOW/contract expiries,
 * creates deduped Action Log entries, sends the matching emails, and logs
 * a one-line summary. Safe to run multiple times a day (dedup via
 * hasOpenAction prevents duplicate actions/emails) and safe to run
 * manually from the editor.
 *
 * Phases (milestones -> resource SOW expiry -> vendor contract expiry) run
 * under a script lock and record which phase last completed in
 * PropertiesService; if a run is ever cut off by the execution time limit,
 * the next run resumes after the last completed phase instead of
 * restarting from scratch. On the current mock-data scale this scaffolding
 * never actually triggers — it's here for when the dataset grows, per
 * CLAUDE.md's execution-time-limit guidance.
 * @param {Date=} today defaults to new Date(); injected for testability
 * @return {{scanned: number, created: number, emailed: number, failed: number, skippedDuplicate: number}}
 */
function runDailyMonitoringScan(today) {
  today = today || new Date();
  ensureFailuresSheet();
  var counters = { scanned: 0, created: 0, emailed: 0, failed: 0, skippedDuplicate: 0 };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    console.error('Could not acquire lock for monitoring scan: ' + e.message);
    return counters;
  }

  var props = PropertiesService.getScriptProperties();
  var RESUME_KEY = 'monitoringScanLastPhase';
  var phases = [
    { name: 'milestones', run: function () { processMilestones_(today, counters); } },
    { name: 'resourceSow', run: function () { processResourceSowExpiries_(today, counters); } },
    { name: 'vendorContracts', run: function () { processVendorContractExpiries_(today, counters); } }
  ];
  var lastPhase = props.getProperty(RESUME_KEY) || '';
  var startIndex = 0;
  var resumeIndex = phases.findIndex(function (p) { return p.name === lastPhase; });
  if (resumeIndex !== -1) startIndex = resumeIndex + 1;

  var startTime = Date.now();
  var budgetMs = 5 * 60 * 1000;
  try {
    for (var i = startIndex; i < phases.length; i++) {
      phases[i].run();
      props.setProperty(RESUME_KEY, phases[i].name);
      if (Date.now() - startTime > budgetMs && i < phases.length - 1) {
        console.log('Monitoring scan approaching time budget after phase "' + phases[i].name +
          '" — stopping early; re-run to continue with the remaining phases.');
        return counters;
      }
    }
    props.deleteProperty(RESUME_KEY);
  } finally {
    lock.releaseLock();
  }

  console.log(counters.scanned + ' items scanned, ' + counters.created + ' actions created, ' +
    counters.emailed + ' emails sent, ' + counters.failed + ' failed, ' +
    counters.skippedDuplicate + ' already open — see Failures tab for details.');
  return counters;
}
