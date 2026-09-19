/**
 * MockData.gs
 * Phase 1 mock data generator. Safe to delete or gate off once real data
 * is loaded from Akanksha. Also owns tab creation for Review Responses and
 * Dashboard, since no dedicated CRUD file exists for them yet — FormHandler.gs
 * (Phase 3) becomes the writer for Review Responses, Dashboard.gs (Phase 4)
 * for Dashboard.
 *
 * All dates are computed relative to an injected "today" (defaults to
 * new Date()) so the milestone/expiry edge cases stay correct no matter
 * when this is run — see runAllPhase1Tests() in Tests.gs for the boundary
 * checks this depends on.
 */

var REVIEW_RESPONSES_SHEET = 'Review Responses';
var REVIEW_RESPONSES_HEADERS = [
  'Resource ID', 'Current Requirement', 'Expected Duration', 'Business Dependency',
  'Internal Replacement Possible', 'Cross-Training Opportunity', 'FTE Conversion Potential',
  'Replacement Timeline', 'Comments', 'Submitted At'
];

var DASHBOARD_SHEET = 'Dashboard';
var DASHBOARD_HEADERS = ['Note'];

/**
 * Adds n calendar months to a date, returning a new Date.
 * @param {Date} date
 * @param {number} n
 * @return {Date}
 */
function addMonths_(date, n) {
  var d = new Date(date.getTime());
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Adds n days to a date, returning a new Date.
 * @param {Date} date
 * @param {number} n
 * @return {Date}
 */
function addDays_(date, n) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Ensures every tab in the system exists with correct headers. Idempotent —
 * safe to call on every run.
 * @return {void}
 */
function ensureAllSheets() {
  ensureVendorMasterSheet();
  ensureResourceMasterSheet();
  ensureContractSowSheet();
  ensureInvoicesSheet();
  ensurePerformanceSheet();
  ensureSavingsSheet();
  ensureActionLogSheet();
  getOrCreateSheet(REVIEW_RESPONSES_SHEET, REVIEW_RESPONSES_HEADERS);
  ensureConfigSheet();
  getOrCreateSheet(DASHBOARD_SHEET, DASHBOARD_HEADERS);
}

/**
 * Deletes all data rows (keeping headers) from every tab this system owns.
 * Used to make mock data regeneration idempotent — safe to re-run.
 * @return {void}
 */
function clearAllMockData() {
  [VENDOR_MASTER_SHEET, RESOURCE_MASTER_SHEET, CONTRACT_SOW_SHEET, INVOICES_SHEET,
    PERFORMANCE_SHEET, SAVINGS_SHEET, ACTION_LOG_SHEET, REVIEW_RESPONSES_SHEET,
    CONFIG_SHEET].forEach(clearSheetRows);
}

/**
 * Seeds the Config tab with placeholder DM emails, default thresholds,
 * placeholder email templates, and the enum vocab lists used by mock data.
 * @return {void}
 */
function seedConfig() {
  setConfigValue('Thresholds', 'SOWExpiryWindowDays1', '30', 'First (more urgent) SOW expiry alert window');
  setConfigValue('Thresholds', 'SOWExpiryWindowDays2', '60', 'Second (earlier heads-up) SOW expiry alert window');
  setConfigValue('System', 'DryRunMode', 'true', 'When true, EmailService logs instead of sending — flip to false only after a demo is approved');

  setConfigValue('DMDirectory', 'Priya Nair', 'priya.nair@example.com');
  setConfigValue('DMDirectory', 'Rahul Verma', 'rahul.verma@example.com');
  setConfigValue('DMDirectory', 'Ananya Iyer', 'ananya.iyer@example.com');
  setConfigValue('DMDirectory', 'Karan Mehta', 'karan.mehta@example.com');

  setConfigValue('EmailTemplates', 'MilestoneReview',
    'Hi {{DMName}},\n\n{{CandidateName}} ({{ResourceId}}) has reached their {{Milestone}} review at {{ClientName}}. Please complete the review form: {{FormLink}}\n\nThanks,\nVendor Management System');
  setConfigValue('EmailTemplates', 'SowExpiry',
    'Hi {{DMName}},\n\n{{CandidateName}}\'s ({{ResourceId}}) SOW with {{VendorName}} expires on {{SowEndDate}}. Please confirm renewal/extension status.\n\nThanks,\nVendor Management System');
  setConfigValue('EmailTemplates', 'SendFailure',
    'Failed to send "{{TemplateName}}" for {{ResourceId}} to {{Recipient}}: {{ErrorMessage}}');

  setConfigValue('EnumVocab', 'Vendor Master.Category', 'Strategic,Preferred,Approved,Specialist');
  setConfigValue('EnumVocab', 'Vendor Master.Type', 'Subcon,FTE,RPO,CTH,IaaS');
  setConfigValue('EnumVocab', 'Vendor Master.MSA Status', 'Active,Pending Renewal,Not Available');
  setConfigValue('EnumVocab', 'Vendor Master.SOW Status', 'Active,Pending,Not Available');
  setConfigValue('EnumVocab', 'Vendor Master.NDA', 'Yes,No');
  setConfigValue('EnumVocab', 'Vendor Master.Due Diligence', 'Completed,Pending,In Progress');
  setConfigValue('EnumVocab', 'Vendor Master.Status', 'Active,Inactive,On Hold');
  setConfigValue('EnumVocab', 'Contracts & SOW.Document Type', 'MSA,SOW');
  setConfigValue('EnumVocab', 'Contracts & SOW.Document Status', 'Active,Pending,Pending Renewal,Not Available');
  setConfigValue('EnumVocab', 'Resource Master.Status', 'Active,Released,Extended,Pending');
  setConfigValue('EnumVocab', 'Resource Master.Rate Unit', 'Hourly,Daily,Monthly');
  setConfigValue('EnumVocab', 'Resource Master.Review Status', 'Not Due,Due,Completed');
  setConfigValue('EnumVocab', 'Invoices.Validation Status', 'Validated,Mismatch');
  setConfigValue('EnumVocab', 'Invoices.Issue Type', 'Missing Resource,Overbill,Underbill');
  setConfigValue('EnumVocab', 'Performance.Overall Status', 'Green,Amber,Red');
  setConfigValue('EnumVocab', 'Savings.Realized / Potential', 'Realized,Potential');
}

/**
 * Returns the mock vendor definitions used by generateMockData. Kept as a
 * separate function so Tests.gs can assert on the exact list.
 * @return {Array<Object>}
 */
function getMockVendorDefs_() {
  return [
    { id: 'VND-001', name: 'Zinterview.AI', category: 'Strategic', type: 'IaaS', skills: 'AI Interviews, ML', geo: 'India', spoc: 'Sanjay Rao', msa: 'Active', sow: 'Active', nda: 'Yes', dd: 'Completed', comm: 7.5, pay: '60 Days', conv: '10% of CTC', status: 'Active' },
    { id: 'VND-002', name: 'BarRaiser Private Limited', category: 'Strategic', type: 'RPO', skills: 'Interview as a Service', geo: 'India', spoc: 'Neha Kulkarni', msa: 'Pending Renewal', sow: 'Pending', nda: 'Yes', dd: 'Pending', comm: 7.5, pay: '30 Days', conv: 'Not Applicable', status: 'Active' },
    { id: 'VND-003', name: 'FloCareer', category: 'Preferred', type: 'RPO', skills: 'Technical Screening', geo: 'India', spoc: 'Amit Joshi', msa: 'Active', sow: 'Active', nda: 'Yes', dd: 'Completed', comm: 6, pay: '45 Days', conv: '8% of CTC', status: 'Active' },
    { id: 'VND-004', name: 'TalentBridge Consulting', category: 'Approved', type: 'Subcon', skills: 'Java, Spring Boot', geo: 'Bengaluru', spoc: 'Ritu Sharma', msa: 'Active', sow: 'Active', nda: 'Yes', dd: 'Completed', comm: 8, pay: '60 Days', conv: '10% of CTC', status: 'Active' },
    { id: 'VND-005', name: 'NextGen Staffing Solutions', category: 'Approved', type: 'Subcon', skills: 'Python, Data Engineering', geo: 'Hyderabad', spoc: 'Vikram Nair', msa: 'Active', sow: 'Active', nda: 'Yes', dd: 'Completed', comm: 7, pay: '45 Days', conv: '10% of CTC', status: 'Active' },
    { id: 'VND-006', name: 'CloudEdge Technologies', category: 'Specialist', type: 'IaaS', skills: 'DevOps, AWS', geo: 'Pune', spoc: 'Meera Pillai', msa: 'Pending Renewal', sow: 'Active', nda: 'Yes', dd: 'In Progress', comm: 6.5, pay: '30 Days', conv: 'Not Applicable', status: 'On Hold' },
    { id: 'VND-007', name: 'Apex Workforce Partners', category: 'Approved', type: 'FTE', skills: 'React, Node.js', geo: 'Chennai', spoc: 'Suresh Kumar', msa: 'Active', sow: 'Active', nda: 'No', dd: 'Pending', comm: 5, pay: '60 Days', conv: '12% of CTC', status: 'Active' },
    { id: 'VND-008', name: 'Vertex Recruitment Services', category: 'Specialist', type: 'CTH', skills: 'QA, Automation Testing', geo: 'Mumbai', spoc: 'Divya Menon', msa: 'Not Available', sow: 'Not Available', nda: 'No', dd: 'Pending', comm: 5.5, pay: '30 Days', conv: '10% of CTC', status: 'Inactive' },
    { id: 'VND-009', name: 'Skylark Talent Solutions', category: 'Preferred', type: 'Subcon', skills: 'DevOps, Node.js', geo: 'Gurugram', spoc: 'Arjun Reddy', msa: 'Active', sow: 'Active', nda: 'Yes', dd: 'Completed', comm: 7, pay: '45 Days', conv: '10% of CTC', status: 'Active' },
    { id: 'VND-010', name: 'Orbit Manpower Consulting', category: 'Specialist', type: 'IaaS', skills: 'Business Analysis, Java', geo: 'Hyderabad', spoc: 'Kavita Desai', msa: 'Not Available', sow: 'Active', nda: 'No', dd: 'Completed', comm: 5, pay: '60 Days', conv: '10% of CTC', status: 'Active' }
  ];
}

/**
 * Generates and writes all Phase 1 mock data (vendors, contracts, resources,
 * invoices, performance, savings) relative to the given "today", deliberately
 * including the boundary cases Phase 2's monitoring logic will be tested
 * against: a milestone hitting exactly today, one hitting tomorrow (must NOT
 * fire), SOW expiry at exactly 30/60 days and already expired, and one
 * resource with a missing Delivery Manager email.
 * @param {Date=} today defaults to new Date(); injected for testability
 * @return {void}
 */
function generateMockData(today) {
  today = today || new Date();
  var vendors = getMockVendorDefs_();
  var dmEmails = ['priya.nair@example.com', 'rahul.verma@example.com', 'ananya.iyer@example.com', 'karan.mehta@example.com'];

  vendors.forEach(function (v) {
    createVendor({
      'Vendor ID': v.id, 'Vendor': v.name, 'Category': v.category, 'Type': v.type,
      'Skills': v.skills, 'Geography': v.geo, 'SPOC': v.spoc,
      'MSA Status': v.msa, 'SOW Status': v.sow, 'NDA': v.nda, 'Due Diligence': v.dd,
      'Commercial %': v.comm, 'Payment Terms': v.pay, 'Conversion Terms': v.conv,
      'Active Resources': 0, 'Monthly Billing': 0, 'Performance': '', 'Savings': 0,
      'Status': v.status
    });

    // Contracts & SOW: one MSA + one SOW per vendor, with a spread of expiry dates.
    var msaExpiry = addMonths_(today, 10);
    var sowExpiry = addMonths_(today, 10);
    if (v.id === 'VND-002') sowExpiry = addDays_(today, 30);   // expiring in exactly 30 days
    if (v.id === 'VND-006') sowExpiry = addDays_(today, 60);   // expiring in exactly 60 days
    if (v.id === 'VND-008') sowExpiry = addDays_(today, -15);  // already expired
    var contractIdBase = 'CTR-' + v.id.slice(-3);
    createContract({
      'Contract ID': contractIdBase + '-M', 'Vendor ID': v.id, 'Vendor': v.name,
      'Document Type': 'MSA', 'Document Status': v.msa, 'Effective Date': addMonths_(today, -14),
      'Expiry Date': msaExpiry, 'Commercial %': v.comm, 'Payment Terms': v.pay,
      'Conversion Terms': v.conv, 'Renewal Required': 'No', 'Key Clause / Note': 'Standard terms'
    });
    createContract({
      'Contract ID': contractIdBase + '-S', 'Vendor ID': v.id, 'Vendor': v.name,
      'Document Type': 'SOW', 'Document Status': v.sow, 'Effective Date': addMonths_(today, -8),
      'Expiry Date': sowExpiry, 'Commercial %': v.comm, 'Payment Terms': v.pay,
      'Conversion Terms': v.conv, 'Renewal Required': 'Yes', 'Key Clause / Note': 'Renewal review required'
    });

    // Invoices: two months, one clean, one with a variance for a couple of vendors.
    var expected = 200000 + (parseInt(v.id.slice(-3), 10) * 15000);
    var mismatch = ['VND-002', 'VND-005', 'VND-009'].indexOf(v.id) !== -1;
    var actualPrev = expected;
    var actualCurr = mismatch ? expected + 35000 : expected;
    createInvoice({
      'Invoice ID': 'INV-' + formatYyyymm_(addMonths_(today, -1)) + '-' + v.id.slice(-3),
      'Vendor ID': v.id, 'Vendor': v.name, 'Invoice Month': addMonths_(today, -1),
      'Invoice Date': addMonths_(today, -1), 'Expected Amount': expected, 'Vendor Invoice Amount': actualPrev,
      'Variance': 0, 'Variance %': 0, 'Validation Status': 'Validated', 'Issue Type': '',
      'Action': 'No Action', 'Finance Submission': 'Ready'
    });
    createInvoice({
      'Invoice ID': 'INV-' + formatYyyymm_(today) + '-' + v.id.slice(-3),
      'Vendor ID': v.id, 'Vendor': v.name, 'Invoice Month': today, 'Invoice Date': today,
      'Expected Amount': expected, 'Vendor Invoice Amount': actualCurr,
      'Variance': actualCurr - expected, 'Variance %': Math.round(((actualCurr - expected) / expected) * 100),
      'Validation Status': mismatch ? 'Mismatch' : 'Validated',
      'Issue Type': mismatch ? 'Overbill' : '',
      'Action': mismatch ? 'Review' : 'No Action',
      'Finance Submission': mismatch ? 'Blocked' : 'Ready'
    });

    // Performance: one row per vendor for the current period.
    var qualityScore = 60 + (parseInt(v.id.slice(-3), 10) * 3) % 35;
    createPerformanceRecord({
      'Performance ID': 'PERF-' + v.id.slice(-3), 'Vendor ID': v.id, 'Vendor': v.name,
      'Review Period': 'FY2026 YTD', 'Requirements Received': 20 + qualityScore % 10,
      'Profiles Submitted': 30 + qualityScore % 15, 'Interviews': 10 + qualityScore % 8,
      'Closures': 3 + qualityScore % 5, 'Average TAT (Days)': (2 + (qualityScore % 5) * 0.5).toFixed(1),
      'Quality Score': qualityScore,
      'Commercial Competitiveness': qualityScore > 80 ? 'Strong' : qualityScore > 65 ? 'Good' : 'Needs Review',
      'Overall Status': qualityScore > 80 ? 'Green' : qualityScore > 65 ? 'Amber' : 'Red',
      'Reviewer Comment': qualityScore > 80 ? 'Strong closure support' : 'Commercial review recommended'
    });

    // Savings: one row per vendor.
    var savingsAmount = 50000 + (parseInt(v.id.slice(-3), 10) * 8000);
    createSavingsRecord({
      'Savings ID': 'SAV-' + v.id.slice(-3), 'Vendor ID': v.id, 'Vendor': v.name,
      'Savings Type': parseInt(v.id.slice(-3), 10) % 2 === 0 ? 'Rate Negotiation' : 'Volume Discount',
      'Original Value': savingsAmount * 4, 'Savings': savingsAmount,
      'Realized / Potential': parseInt(v.id.slice(-3), 10) % 3 === 0 ? 'Potential' : 'Realized',
      'Date': addDays_(today, -20), 'Owner': 'Vendor Management', 'Notes': 'Auto-generated mock savings entry'
    });
  });

  generateMockResources_(today, vendors, dmEmails);
}

/**
 * Formats a date as YYYYMM for Invoice ID construction.
 * @param {Date} date
 * @return {string}
 */
function formatYyyymm_(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  return '' + y + m;
}

/**
 * Generates the ~18 mock resources, deliberately including the milestone
 * and SOW-expiry boundary cases described in generateMockData's docstring.
 * @param {Date} today
 * @param {Array<Object>} vendors
 * @param {Array<string>} dmEmails
 * @return {void}
 * @private
 */
function generateMockResources_(today, vendors, dmEmails) {
  var reviewStatus = function (monthsSinceDoj, milestone) {
    return monthsSinceDoj >= milestone ? 'Completed' : 'Not Due';
  };

  var resources = [];

  // R1-R3: milestone hits exactly today for 3M, 6M, 9M respectively.
  [3, 6, 9].forEach(function (milestone, i) {
    var doj = addMonths_(today, -milestone);
    resources.push({
      idx: i + 1, doj: doj, sowEnd: addMonths_(today, 6), milestoneToday: milestone,
      dmEmail: dmEmails[i % dmEmails.length]
    });
  });

  // R4: milestone (3M) hits tomorrow, must NOT fire today.
  resources.push({
    idx: 4, doj: addMonths_(addDays_(today, 1), -3), sowEnd: addMonths_(today, 6), milestoneToday: null,
    dmEmail: dmEmails[0]
  });

  // R5-R7: SOW expiry boundary cases (DOJ arbitrary, well past any milestone).
  resources.push({ idx: 5, doj: addMonths_(today, -12), sowEnd: addDays_(today, 30), milestoneToday: null, dmEmail: dmEmails[1] });
  resources.push({ idx: 6, doj: addMonths_(today, -12), sowEnd: addDays_(today, 60), milestoneToday: null, dmEmail: dmEmails[2] });
  resources.push({ idx: 7, doj: addMonths_(today, -12), sowEnd: addDays_(today, -5), milestoneToday: null, dmEmail: dmEmails[3] });

  // R8: missing Delivery Manager email — must not crash mock generation or Phase 2.
  resources.push({ idx: 8, doj: addMonths_(today, -4), sowEnd: addMonths_(today, 8), milestoneToday: null, dmEmail: '' });

  // R9-R18: filler, varied DOJ/status, no edge case.
  var fillerDesignations = ['Java Developer', 'Python Developer', 'DevOps Engineer', 'QA Engineer', 'Business Analyst', 'React Developer', 'Data Engineer', 'Node.js Developer', 'ML Engineer', 'Automation Tester'];
  var fillerSkills = ['Java', 'Python', 'AWS', 'Selenium', 'Business Analysis', 'React', 'Data Engineering', 'Node.js', 'Machine Learning', 'Test Automation'];
  var fillerClients = ['Client A', 'Client B', 'Client C', 'Internal'];
  var fillerStatuses = ['Active', 'Active', 'Active', 'Released', 'Extended'];
  for (var i = 0; i < 10; i++) {
    resources.push({
      idx: 9 + i, doj: addMonths_(today, -(2 + i)), sowEnd: addMonths_(today, 4 + i), milestoneToday: null,
      dmEmail: dmEmails[i % dmEmails.length], filler: i
    });
  }

  resources.forEach(function (r) {
    var vendor = vendors[(r.idx - 1) % vendors.length];
    var resourceId = 'RES-' + ('0000' + r.idx).slice(-4);
    var monthsSinceDoj = Math.floor((today.getTime() - r.doj.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
    var designation = r.filler !== undefined ? fillerDesignations[r.filler] : 'Software Engineer';
    var skill = r.filler !== undefined ? fillerSkills[r.filler] : vendor.skills.split(',')[0].trim();
    var client = r.filler !== undefined ? fillerClients[r.filler % fillerClients.length] : 'Client A';
    var status = r.filler !== undefined ? fillerStatuses[r.filler % fillerStatuses.length] : 'Active';

    createResource({
      'Resource ID': resourceId, 'Vendor ID': vendor.id, 'Vendor': vendor.name,
      'Candidate Name': 'Candidate ' + resourceId.slice(-4), 'Tm No.': 'TM-' + (1000 + r.idx),
      'Email ID': 'candidate' + r.idx + '@example.com', 'Service Type': vendor.type,
      'Designation': designation, 'DOJ': r.doj, 'SOW Start Date': addMonths_(r.doj, 0),
      'SOW End Date': r.sowEnd, 'Rate Unit': ['Hourly', 'Daily', 'Monthly'][r.idx % 3],
      'Rates (as per SOW)': 800 + r.idx * 50, 'Skill': skill, 'Client': client, 'Status': status,
      'Remarks': '', 'Delivery Manager Email': r.dmEmail,
      '3M Review Date': addMonths_(r.doj, 3), '3M Review Status': reviewStatus(monthsSinceDoj, 3),
      '6M Review Date': addMonths_(r.doj, 6), '6M Review Status': reviewStatus(monthsSinceDoj, 6),
      '9M Review Date': addMonths_(r.doj, 9), '9M Review Status': reviewStatus(monthsSinceDoj, 9),
      'Long-Term Dependency': '', 'Cross-Training Candidate': '', 'FTE Conversion Candidate': '',
      'Next Action / Due Date': ''
    });
  });
}

/**
 * Full Phase 1 setup: ensures all tabs exist, clears any previous mock
 * data, regenerates it, and seeds Config. Safe to re-run at any time.
 * @return {void}
 */
function setupPhase1() {
  ensureAllSheets();
  clearAllMockData();
  seedConfig();
  generateMockData(new Date());
  console.log('Phase 1 setup complete: tabs created, mock data + Config seeded.');
}
