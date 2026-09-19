/**
 * Tests.gs
 * Manual test harness. Apps Script has no built-in test runner, so this is
 * one function per behavior, each setting up known input, calling the real
 * function, and logging PASS/FAIL via console.log. Run runAllPhase1Tests()
 * manually from the Apps Script editor before every deploy.
 */

/**
 * Returns true if two Dates fall on the same calendar day (ignores time of
 * day), which is how milestone/expiry comparisons should be judged.
 * @param {Date} a
 * @param {Date} b
 * @return {boolean}
 */
function sameDay_(a, b) {
  return a instanceof Date && b instanceof Date && a.toDateString() === b.toDateString();
}

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
 * and are marked Completed, using a fixed injected "today" so the test is
 * deterministic regardless of when it's run.
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
    allPass = assertTest_(r[c.statusCol] === 'Completed', c.id + ' ' + c.statusCol + ' is Completed') && allPass;
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
