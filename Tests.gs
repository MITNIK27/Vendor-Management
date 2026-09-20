/**
 * Tests.gs
 * Manual test harness. Apps Script has no built-in test runner, so this is
 * one function per behavior, each setting up known input, calling the real
 * function, and logging PASS/FAIL via console.log. Run runAllPhase1Tests()
 * manually from the Apps Script editor before every deploy.
 */

/**
 * Asserts a condition and logs PASS/FAIL with a message, returning whether
 * it passed.
 * @param {boolean} condition
 * @param {string} message
 * @return {boolean}
 */
function assertTest_(condition, message) {
  console.log((condition ? 'PASS' : 'FAIL') + ' - ' + message);
  return condition;
}

/**
 * Verifies every tab exists with exactly the expected header row.
 * @return {boolean}
 */
function test_allTabsHaveCorrectHeaders() {
  var expectations = [
    [VENDOR_MASTER_SHEET, VENDOR_MASTER_HEADERS],
    [RESOURCE_MASTER_SHEET, RESOURCE_MASTER_HEADERS],
    [CONTRACT_SOW_SHEET, CONTRACT_SOW_HEADERS],
    [INVOICES_SHEET, INVOICES_HEADERS],
    [PERFORMANCE_SHEET, PERFORMANCE_HEADERS],
    [SAVINGS_SHEET, SAVINGS_HEADERS],
    [ACTION_LOG_SHEET, ACTION_LOG_HEADERS],
    [REVIEW_RESPONSES_SHEET, REVIEW_RESPONSES_HEADERS],
    [CONFIG_SHEET, CONFIG_HEADERS],
    [DASHBOARD_SHEET, DASHBOARD_HEADERS]
  ];
  var allPass = true;
  expectations.forEach(function (pair) {
    var actual = getHeaders(pair[0]);
    var expected = pair[1];
    var matches = JSON.stringify(actual) === JSON.stringify(expected);
    allPass = assertTest_(matches, pair[0] + ' headers match expected') && allPass;
  });
  return allPass;
}

/**
 * Verifies mock data loaded the expected row counts per tab.
 * @return {boolean}
 */
function test_mockDataLoaded() {
  var allPass = true;
  allPass = assertTest_(getAllVendors().length === 10, 'Vendor Master has 10 vendors') && allPass;
  allPass = assertTest_(getAllResources().length === 18, 'Resource Master has 18 resources') && allPass;
  allPass = assertTest_(getAllContracts().length === 20, 'Contracts & SOW has 20 rows (2 per vendor)') && allPass;
  allPass = assertTest_(getAllInvoices().length === 20, 'Invoices has 20 rows (2 per vendor)') && allPass;
  allPass = assertTest_(getAllPerformanceRecords().length === 10, 'Performance has 10 rows') && allPass;
  allPass = assertTest_(getAllSavingsRecords().length === 10, 'Savings has 10 rows') && allPass;
  return allPass;
}

/**
 * Verifies RES-0001/0002/0003 hit their 3M/6M/9M milestone exactly today
 * and are marked Due (not yet Completed — that only happens once Phase 3's
 * DM response closes it out), using a fixed injected "today" so the test
 * is deterministic regardless of when it's run.
 * @return {boolean}
 */
function test_milestoneDetectionFiresOnExactDay() {
  var today = new Date();
  setupPhase1WithDate_(today);
  var allPass = true;
  var cases = [
    { id: 'RES-0001', dateCol: '3M Review Date', statusCol: '3M Review Status' },
    { id: 'RES-0002', dateCol: '6M Review Date', statusCol: '6M Review Status' },
    { id: 'RES-0003', dateCol: '9M Review Date', statusCol: '9M Review Status' }
  ];
  cases.forEach(function (c) {
    var r = getResourceById(c.id);
    allPass = assertTest_(r !== null, c.id + ' exists') && allPass;
    if (!r) return;
    allPass = assertTest_(sameDay_(r[c.dateCol], today), c.id + ' ' + c.dateCol + ' falls on today') && allPass;
    allPass = assertTest_(r[c.statusCol] === 'Due', c.id + ' ' + c.statusCol + ' is Due') && allPass;
  });
  return allPass;
}

/**
 * Verifies RES-0004's 3-month milestone falls tomorrow, not today, and its
 * status is NOT Completed — the boundary case that Phase 2 must not fire on.
 * @return {boolean}
 */
function test_milestoneTomorrowDoesNotFireToday() {
  var today = new Date();
  setupPhase1WithDate_(today);
  var r = getResourceById('RES-0004');
  var allPass = true;
  allPass = assertTest_(r !== null, 'RES-0004 exists') && allPass;
  if (!r) return allPass;
  allPass = assertTest_(!sameDay_(r['3M Review Date'], today), 'RES-0004 3M Review Date is NOT today') && allPass;
  allPass = assertTest_(sameDay_(r['3M Review Date'], addDays_(today, 1)), 'RES-0004 3M Review Date is tomorrow') && allPass;
  allPass = assertTest_(r['3M Review Status'] !== 'Completed', 'RES-0004 3M Review Status is not Completed yet') && allPass;
  return allPass;
}

/**
 * Verifies RES-0005/0006/0007 carry the SOW-expiry boundary cases: exactly
 * 30 days out, exactly 60 days out, and already expired.
 * @return {boolean}
 */
function test_sowExpiryBoundaryCases() {
  var today = new Date();
  setupPhase1WithDate_(today);
  var allPass = true;
  var r5 = getResourceById('RES-0005');
  var r6 = getResourceById('RES-0006');
  var r7 = getResourceById('RES-0007');
  allPass = assertTest_(r5 && sameDay_(r5['SOW End Date'], addDays_(today, 30)), 'RES-0005 SOW End Date is exactly 30 days out') && allPass;
  allPass = assertTest_(r6 && sameDay_(r6['SOW End Date'], addDays_(today, 60)), 'RES-0006 SOW End Date is exactly 60 days out') && allPass;
  allPass = assertTest_(r7 && r7['SOW End Date'] < today, 'RES-0007 SOW End Date is already in the past') && allPass;
  return allPass;
}

/**
 * Verifies RES-0008 has a blank Delivery Manager Email and that mock data
 * generation did not crash or skip creating it — the graceful-failure path
 * Phase 2's monitoring loop must also handle without stopping the whole run.
 * @return {boolean}
 */
function test_missingDmEmailHandledGracefully() {
  setupPhase1WithDate_(new Date());
  var r = getResourceById('RES-0008');
  var allPass = true;
  allPass = assertTest_(r !== null, 'RES-0008 exists despite missing DM email') && allPass;
  if (r) allPass = assertTest_(r['Delivery Manager Email'] === '', 'RES-0008 Delivery Manager Email is blank') && allPass;
  return allPass;
}

/**
 * Verifies at least one invoice per run is flagged Mismatch with a nonzero
 * variance, for Phase 4 testing later.
 * @return {boolean}
 */
function test_invoiceMismatchesPresent() {
  setupPhase1WithDate_(new Date());
  var mismatches = findRecords(INVOICES_SHEET, function (r) { return r['Validation Status'] === 'Mismatch'; });
  return assertTest_(mismatches.length > 0, 'At least one invoice is flagged Mismatch');
}

/**
 * Verifies runDailyMonitoringScan creates actions for RES-0001/2/3 (today's
 * milestones) but not for RES-0004 (tomorrow's).
 * @return {boolean}
 */
function test_milestoneScanFiresOnlyOnExactDay() {
  var today = new Date();
  setupPhase1WithDate_(today);
  runDailyMonitoringScan(today);
  var allPass = true;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0001', 'Review 3M'), 'RES-0001 got a Review 3M action today') && allPass;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0002', 'Review 6M'), 'RES-0002 got a Review 6M action today') && allPass;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0003', 'Review 9M'), 'RES-0003 got a Review 9M action today') && allPass;
  allPass = assertTest_(!hasOpenAction('Resource ID', 'RES-0004', 'Review 3M'), 'RES-0004 got no action (milestone is tomorrow)') && allPass;
  return allPass;
}

/**
 * Verifies running the daily scan twice in a row does not create duplicate
 * Action Log rows for the same resource/type — the core dedup guarantee
 * CLAUDE.md requires (safe to re-run manually with no side effects).
 * @return {boolean}
 */
function test_dedupPreventsDoubleAction() {
  var today = new Date();
  setupPhase1WithDate_(today);
  runDailyMonitoringScan(today);
  var countAfterFirstRun = findRecords(ACTION_LOG_SHEET, function (r) {
    return r['Resource ID'] === 'RES-0001' && r.Type === 'Review 3M';
  }).length;
  runDailyMonitoringScan(today);
  var countAfterSecondRun = findRecords(ACTION_LOG_SHEET, function (r) {
    return r['Resource ID'] === 'RES-0001' && r.Type === 'Review 3M';
  }).length;
  var allPass = true;
  allPass = assertTest_(countAfterFirstRun === 1, 'First scan creates exactly one Review 3M action for RES-0001') && allPass;
  allPass = assertTest_(countAfterSecondRun === 1, 'Second scan does not create a duplicate') && allPass;
  return allPass;
}

/**
 * Verifies the resource-level SOW expiry buckets: RES-0005 (30 days out)
 * lands in the urgent 30d bucket, RES-0006 (60 days out) in the heads-up
 * 60d bucket, and RES-0007 (already expired) also in the 30d bucket since
 * that bucket is "<=30 days remaining", which naturally includes negative
 * (past) values.
 * @return {boolean}
 */
function test_resourceSowExpiryThresholds() {
  var today = new Date();
  setupPhase1WithDate_(today);
  runDailyMonitoringScan(today);
  var allPass = true;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0005', 'Resource SOW Expiry 30d'), 'RES-0005 (30 days out) got the 30d urgent action') && allPass;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0006', 'Resource SOW Expiry 60d'), 'RES-0006 (60 days out) got the 60d heads-up action') && allPass;
  allPass = assertTest_(hasOpenAction('Resource ID', 'RES-0007', 'Resource SOW Expiry 30d'), 'RES-0007 (already expired) got the 30d urgent action') && allPass;
  return allPass;
}

/**
 * Verifies the vendor-level Contracts & SOW expiry buckets mirror the
 * resource-level ones: VND-002's SOW contract (30 days out) -> 30d urgent,
 * VND-006's SOW contract (60 days out) -> 60d heads-up, VND-008's SOW
 * contract (already expired) -> 30d urgent.
 * @return {boolean}
 */
function test_vendorContractExpiryThresholds() {
  var today = new Date();
  setupPhase1WithDate_(today);
  runDailyMonitoringScan(today);
  var allPass = true;
  allPass = assertTest_(hasOpenAction('Vendor ID', 'VND-002', 'Vendor SOW Expiry 30d'), 'VND-002 (30 days out) got the 30d urgent action') && allPass;
  allPass = assertTest_(hasOpenAction('Vendor ID', 'VND-006', 'Vendor SOW Expiry 60d'), 'VND-006 (60 days out) got the 60d heads-up action') && allPass;
  allPass = assertTest_(hasOpenAction('Vendor ID', 'VND-008', 'Vendor SOW Expiry 30d'), 'VND-008 (already expired) got the 30d urgent action') && allPass;
  return allPass;
}

/**
 * Verifies RES-0008's missing Delivery Manager Email is handled as an
 * expected, graceful condition: a Warning row lands in Failures and the
 * scan completes without throwing (it still creates the Action Log entry
 * so Akanksha doesn't lose the follow-up just because the email couldn't
 * be sent).
 * @return {boolean}
 */
function test_missingDmEmailLogsFailureNotCrash() {
  var today = new Date();
  setupPhase1WithDate_(today);
  var result = runDailyMonitoringScan(today);
  var allPass = true;
  allPass = assertTest_(result.failed >= 0, 'Scan completed without throwing') && allPass;
  var failureRows = findRecords(FAILURES_SHEET, function (r) { return r['Entity ID'] === 'RES-0008'; });
  allPass = assertTest_(failureRows.length > 0, 'RES-0008 has a Failures row logged') && allPass;
  if (failureRows.length > 0) {
    allPass = assertTest_(failureRows[0].Severity === 'Warning', 'RES-0008\'s Failures row is Warning severity (expected/handled), not Error') && allPass;
  }
  return allPass;
}

/**
 * Verifies dry-run mode's code path: with DryRunMode true (the seeded
 * default), sendTemplatedEmail returns true via the logged-simulation
 * branch without needing to call MailApp. This checks the dry-run branch
 * runs cleanly — the guarantee that MailApp is never reached comes from
 * the isDryRunMode() check in EmailService.gs itself, which is a
 * code-reading guarantee, not something a test can independently observe.
 * @return {boolean}
 */
function test_dryRunDoesNotActuallySend() {
  setupPhase1WithDate_(new Date());
  var sent = sendTemplatedEmail(
    'someone@example.com', 'MilestoneReview',
    { DMName: 'Test', CandidateName: 'Test Candidate', ResourceId: 'RES-TEST', Milestone: '3-month', ClientName: 'Client A', FormLink: 'http://example.com' },
    'Dry-run test', 'RES-TEST'
  );
  return assertTest_(sent === true, 'sendTemplatedEmail returns true via the dry-run simulation path');
}

/**
 * Runs setupPhase1 with a given "today" without re-seeding Config every
 * time (seedConfig() is idempotent via setConfigValue's upsert, so this
 * just calls setupPhase1 directly). Wrapper kept separate so tests read
 * clearly about what date they're pinning.
 * @param {Date} today
 * @return {void}
 * @private
 */
function setupPhase1WithDate_(today) {
  ensureAllSheets();
  clearAllMockData();
  seedConfig();
  generateMockData(today);
}

/**
 * Runs every Phase 1 test function and logs a pass/fail summary.
 * @return {void}
 */
function runAllPhase1Tests() {
  var tests = [
    test_allTabsHaveCorrectHeaders,
    test_mockDataLoaded,
    test_milestoneDetectionFiresOnExactDay,
    test_milestoneTomorrowDoesNotFireToday,
    test_sowExpiryBoundaryCases,
    test_missingDmEmailHandledGracefully,
    test_invoiceMismatchesPresent
  ];
  var passed = 0;
  tests.forEach(function (t) {
    console.log('--- ' + t.name + ' ---');
    if (t()) passed++;
  });
  console.log(passed + '/' + tests.length + ' Phase 1 test functions passed.');
}

/**
 * Runs every Phase 2 test function and logs a pass/fail summary. Does NOT
 * include ensureDailyTrigger's idempotency — that has a real side effect
 * (installing a live recurring trigger on the account) and stays a manual,
 * deliberate step, never exercised by an automated test run.
 * @return {void}
 */
function runAllPhase2Tests() {
  var tests = [
    test_milestoneScanFiresOnlyOnExactDay,
    test_dedupPreventsDoubleAction,
    test_resourceSowExpiryThresholds,
    test_vendorContractExpiryThresholds,
    test_missingDmEmailLogsFailureNotCrash,
    test_dryRunDoesNotActuallySend
  ];
  var passed = 0;
  tests.forEach(function (t) {
    console.log('--- ' + t.name + ' ---');
    if (t()) passed++;
  });
  console.log(passed + '/' + tests.length + ' Phase 2 test functions passed.');
}
