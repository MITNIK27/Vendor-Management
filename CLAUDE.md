# Vendor & Subcontractor Workforce System — Project Brief

## What this is
A Google Apps Script + Google Sheets system that automates vendor/subcontractor
tracking for one user (Akanksha), who currently manages everything manually in
Excel. It replaces manual date-checking and follow-ups with automated
monitoring, email triggers, and a Delivery Manager review workflow.

Full architecture and decision rationale: see `docs/architecture-plan.md`
(exported from the planning doc — paste the full plan there before starting,
or ask me to fetch it).

This is a **full build**, not a stripped MVP — take the time needed to do each
phase properly. We are building and testing against **mock data first**; no
real spreadsheet data exists yet. The system will be demoed internally before
being shown to Akanksha, so usability and correctness matter more than speed.

## Environment
- **Platform:** Google Apps Script (bound to a Google Sheet), written and
  version-controlled locally via **clasp**, edited in this Claude Code session.
- **Data layer:** Google Sheets (multi-tab spreadsheet acting as the DB).
- **Interface for Delivery Managers:** Google Form (MVP) — may later become a
  small Apps Script HtmlService web page if adoption is an issue.
- **AI layer (Phase 5 only):** Gemini API, called via `UrlFetchApp` from
  Apps Script.
- **No hosting, no external backend, no other users yet** — single owner,
  design so the schema could migrate to a real DB later without rework.

## One-time setup required before coding (do this first, in order)
1. Install Node.js if not already present.
2. `npm install -g @google/clasp`
3. `clasp login` — authorizes against the Google account that will own the
   Sheet and script.
4. Enable the **Google Apps Script API** for that account at
   https://script.google.com/home/usersettings (toggle must be ON, or clasp
   cannot create/push projects).
5. Create the Google Sheet (see schema below), then either:
   - `clasp create --type sheets --title "Vendor Workforce System"` to create
     a new bound script, or
   - `clasp clone <scriptId>` if the Sheet + bound script already exist.
6. `clasp login --status` to confirm the local project is linked correctly.
7. Enable the **Advanced Google Services** we'll need in `appsscript.json`
   as they come up (Sheets API is available by default via `SpreadsheetApp`;
   Gmail via `GmailApp`/`MailApp` needs no extra enabling; Forms integration
   needs `FormApp` — also default-available).
8. If Phase 5 (Gemini API) is reached: get a Gemini API key and store it in
   **Script Properties** (`PropertiesService`), never hardcoded in source.

Confirm each of these steps actually worked (e.g. `clasp status`) before
writing any Apps Script code — a broken clasp link is the most common failure
mode here.

## Data model

### Tab 1: Vendor Master (one row per vendor)
| Column | Notes |
|---|---|
| Vendor | Primary key for this tab |
| Category | |
| Type | Subcon / FTE / RPO / CTH / IaaS |
| Skills | |
| Geography | |
| SPOC | |
| MSA Status | |
| SOW Status | |
| NDA | |
| Due Diligence | |
| Commercial % | |
| Payment Terms | |
| Conversion Terms | |
| Active Resources | count, can be a formula referencing Resource Master |
| Monthly Billing | |
| Last Invoice | |
| Performance | |
| Savings | |
| Status | |

### Tab 2: Resource Master (one row per individual)
Original columns, expanded:
| Column | Notes |
|---|---|
| Resource ID | **New** — stable unique key, needed to link Form responses back |
| Vendor | Foreign key to Vendor Master |
| Candidate Name | |
| Tm No. | |
| Email ID | |
| Service Type | |
| Designation | |
| DOJ | Date of joining |
| SOW Start Date | **New** |
| SOW End Date | |
| Rate Unit | |
| Rates (as per SOW) | |
| Invoice Amount | |
| Skill | |
| Client | |
| Status | Active / Released / Extended / Pending |
| Remarks | |
| Delivery Manager Email | **New** — needed so scripts know who to email |
| 3M Review Date / Status | **New** — auto-calculated from DOJ |
| 6M Review Date / Status | **New** |
| 9M Review Date / Status | **New** |
| Long-Term Dependency | **New** — from DM response |
| Cross-Training Candidate | **New** |
| FTE Conversion Candidate | **New** |
| Next Action / Due Date | **New** — mirrors Action Log for quick view |

### Tab 3: Action Log (one row per generated action)
`Date Created | Resource ID | Type (SOW Expiry / Review / Invoice Variance) | Priority | Owner | Due Date | Status | Date Closed`

### Tab 4: Review Responses (one row per Form submission)
Mirrors the Delivery Manager assessment fields: Resource ID, Current
Requirement, Expected Duration, Business Dependency, Internal Replacement
Possible, Cross-Training Opportunity, FTE Conversion Potential, Replacement
Timeline, Comments, Submitted At.

### Tab 5: Config
Email templates (editable without touching code), SOW expiry alert windows
(default 30/60 days), Delivery Manager directory (name → email), any other
tunable thresholds.

### Tab 6: Dashboard
Fed by the other tabs — either an in-sheet summary or a Looker Studio report
connected directly to the spreadsheet (Phase 4).

## Build order (do not skip ahead)

**Phase 1 — Foundation**
- Build all tabs above with correct headers.
- Generate realistic mock data: several vendors, ~15–20 mock resources with
  varied DOJ dates (some hitting 3/6/9 months soon, some not), some SOWs
  expiring within 30/60 days, some invoice mismatches.
- Populate Config with placeholder DM emails and default thresholds.

**Phase 2 — Automated monitoring**
- Daily Apps Script trigger (`ScriptApp.newTrigger(...).timeBased().everyDays(1)`):
  - Scan DOJ → detect resources hitting exactly 3/6/9 months today.
  - Scan SOW End Date → flag <60 and <30 days remaining.
  - Write results into Action Log (no duplicates — check for an existing open
    action of the same type/resource before creating a new one).
  - Send the corresponding email (templates from Config).
- **Critical requirements for this phase:** de-duplication (never re-send the
  same alert twice), idempotent runs (safe to run the trigger manually
  without side effects), and a failure log for any email that doesn't send.

**Phase 3 — Closing the loop**
- Build the Google Form matching the Review Responses schema.
- `onFormSubmit` trigger: write to Review Responses, update the matching
  Resource Master row (by Resource ID), close the originating Action Log
  entry, and — if "long-term" was selected — auto-create a new Action Log
  entry for FTE/cross-train evaluation.

**Phase 4 — Visibility**
- Invoice variance logic: expected = Rate × billing unit × period, compare to
  Invoice Amount, flag exceptions into Action Log.
- Dashboard tab or Looker Studio view: active subcontractors, vendor spend,
  SOWs expiring soon, reviews due, invoice exceptions, long-term dependencies.

**Phase 5 — AI insight layer (only after 1–4 are stable)**
- Weekly trigger calls the Gemini API with a summary of current Action Log +
  Resource Master state, and emails Akanksha a plain-English insight
  (e.g. "11 subcontractors have been active >9 months, 7 have continued
  demand..."). This produces **insight only** — no automated decisions.

## Explicit non-goals for this build
Do not build: a chatbot interface, a full vendor portal, hiring/conversion
decision automation, or more than the one dashboard described above. Keep
every automated action framed as "surface it to a human," never "decide for
a human."

## Project file structure
Apps Script has no folders inside a single project, but file naming should
simulate separation of concerns. Use this layout in the clasp-synced local
project (each `.gs` file becomes a separate file in the Apps Script editor):

```
appsscript.json          # manifest — scopes, timezone, advanced services
Config.gs                # reads/writes the Config tab; no business logic
SheetService.gs          # thin wrapper around SpreadsheetApp calls — every
                          #   other file reads/writes sheets through this,
                          #   never calls SpreadsheetApp directly
ResourceMaster.gs         # CRUD + lookups for the Resource Master tab
VendorMaster.gs           # CRUD + lookups for the Vendor Master tab
ActionLog.gs              # create/close/query actions; de-dup logic lives here
Monitoring.gs              # Phase 2: the daily trigger's scan logic (SOW
                          #   expiry, 3/6/9-month detection) — calls
                          #   ActionLog + EmailService, no sheet access directly
EmailService.gs            # all MailApp/GmailApp calls, template rendering
                          #   from Config, send-failure logging
FormHandler.gs             # Phase 3: onFormSubmit logic
InvoiceCheck.gs             # Phase 4: variance detection
Dashboard.gs                # Phase 4: dashboard/rollup calculations
AiInsight.gs                 # Phase 5: Gemini API calls via UrlFetchApp
Triggers.gs                  # ONLY place that creates/deletes time- and
                          #   form-based triggers — see quotas section below
Tests.gs                    # manual test harness functions (see Testing)
MockData.gs                  # Phase 1 mock data generator, safe to delete
                          #   or gate off once real data is loaded
```

Every function gets a one-line JSDoc comment stating what it does, its
parameters, and its return value — Apps Script has no type system, so this is
the only documentation a future reader (including future-you) gets:

```javascript
/**
 * Returns resources whose DOJ falls exactly on a 3, 6, or 9 month boundary
 * as of today. Does not check whether an action already exists for them.
 * @param {Date} today - injected for testability, defaults to new Date()
 * @return {Array<{resourceId: string, milestone: number}>}
 */
function findResourcesAtMilestone(today) { ... }
```

## Error handling & logging
- Every function that calls an external service (MailApp, UrlFetchApp,
  FormApp) wraps the call in `try/catch`. On failure: log via
  `console.error` (visible in Apps Script's execution log / Cloud Logging)
  AND write a row to a `Failures` section of the Action Log (or a dedicated
  Failures tab) so a silent failure never just disappears — Akanksha should
  never lose a follow-up because an email quietly failed.
- Never let one resource's processing error stop the whole daily scan: loop
  over resources with per-item try/catch, collect errors, continue, and
  report a summary at the end of the run (e.g. "18/20 processed, 2 failed —
  see Failures tab").
- Distinguish "expected, handled" conditions (no vendor SPOC on file) from
  "unexpected" ones (a malformed date) — the former logs a warning and
  continues silently; the latter should be loud enough that it gets fixed.

## Quotas & concurrency (Apps Script-specific — easy to overlook)
- **MailApp/GmailApp daily quota**: consumer Google accounts get ~100
  emails/day via `MailApp`, more via `GmailApp` on Workspace accounts, but it
  is finite. Batch and count sends per run; log if a run approaches the
  quota rather than failing silently mid-run.
- **Execution time limit**: a single Apps Script execution is capped (6
  minutes on most accounts). The daily monitoring scan must be written to
  process resources in a way that can pick up where it left off if the
  dataset grows — don't assume the resource list will always be tiny.
- **Trigger management**: never create a new time-based trigger on every
  script run — check `ScriptApp.getProjectTriggers()` first, or triggers
  will silently multiply and the daily scan will run multiple times a day,
  causing duplicate emails. `Triggers.gs` should have one idempotent
  "ensure triggers exist" function, run manually once during setup, not on
  every deploy.
- **Concurrent writes**: if more than one trigger could touch the same sheet
  at the same time (e.g. a form submission arriving while the daily scan
  runs), wrap the write section in `LockService.getScriptLock()` to avoid a
  race condition corrupting a row.

## Testing strategy
Apps Script has no built-in unit test runner, so testing here means:
1. **Mock data first** (Phase 1) — realistic edge cases baked in: a resource
   hitting a milestone today, one hitting it tomorrow (should NOT fire), one
   with a missing DM email (should fail gracefully, not crash the run), one
   SOW expiring in exactly 30 days, one already past expiry.
2. **`Tests.gs` manual harness** — one function per behavior
   (`test_milestoneDetection()`, `test_dedupPreventsDoubleEmail()`, etc.)
   that sets up known input, calls the real function, and logs pass/fail via
   `console.log`/`Logger.log`. Run these manually from the Apps Script editor
   before every deploy. Not automated CI, but repeatable and explicit.
3. **Dry-run mode**: `EmailService.gs` should support a flag (from Config)
   that logs what it *would* send instead of actually sending — use this to
   verify a full daily-scan run without spamming real inboxes during
   development and the internal demo phase.
4. Before showing Akanksha anything, run a full cycle against mock data end
   to end (scan → email → mock form response → status update → action
   closed) and confirm every tab reflects the expected state.

## Version control (clasp + git)
- Initialize a git repo in the local clasp-synced folder; commit
  `appsscript.json`, all `.gs` files, and this `CLAUDE.md`.
- Add a `.claspignore` so clasp doesn't push files you don't want in the
  Apps Script project (e.g. `README.md`, `.git/`), and a matching
  `.gitignore` for anything local-only (e.g. `.clasp.json` if it contains a
  script ID you don't want public — keep it private if the repo will ever be
  shared).
- Commit at the end of each completed phase at minimum, with a message
  naming the phase (e.g. "Phase 2: daily monitoring + SOW/milestone
  detection"). This gives a clean rollback point if a later phase breaks
  something earlier.
- `clasp push` deploys to the live script; treat it like a deploy step, not
  an autosave — push deliberately after testing, not after every small edit.

## Security
- No API keys, tokens, or secrets in any `.gs` file — use
  `PropertiesService.getScriptProperties()` for the Gemini API key (Phase 5)
  and anything else sensitive. Never log a secret's value, even in error
  messages.
- The bound script runs with the permissions of the account that owns it;
  since this is single-owner today, that's fine, but note it in the doc for
  when the team grows (see Section 1 of the architecture plan) — that's the
  point access needs revisiting.
- Validate/sanitize anything coming from the Google Form before writing it
  into a sheet formula-adjacent context (Sheets can interpret leading `=` in
  a cell as a formula — strip or escape it on write to avoid accidental
  formula injection from a free-text field).

## Coding conventions
- All business rules (thresholds, "what counts as overdue," email trigger
  logic) live in clearly named, separated functions per the file structure
  above — not tangled together — since this may need to migrate off Apps
  Script later if the team grows.
- Store all tunable values (thresholds, templates, DM emails) in the Config
  tab, not hardcoded in `.gs` files.
- Every sheet read/write goes through `SheetService.gs` — no other file
  calls `SpreadsheetApp` directly. This is what makes a future migration
  (Sheets → real database) a change in one file instead of everywhere.

## Definition of done, per phase
A phase isn't complete until:
- Its `Tests.gs` functions all pass against mock data.
- A full dry run (see Testing strategy) produces the expected tab state with
  no unhandled errors in the execution log.
- The code for that phase is committed with a message naming the phase.
- Anything it added to Config (new template, new threshold) is documented
  with a comment in the Config tab itself, not just in code.
