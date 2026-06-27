# HANDOFF — Autonomous Substitution Engine work

## Current task

Implementing a scoped slice of the "ULTIMATE FACULTY CREDIT MANAGEMENT SYSTEM UPGRADE PROMPT"
(see `/mnt/user-data/uploads/finaal_improvements_prompt.txt`), which asked for ~10 major
subsystems (drag-and-drop timetable builder, autonomous substitute engine, fairness
scoring, swap chains, WebSocket live dashboard, dark mode/glassmorphism, predictive
analytics, command-center dashboard, etc).

After discussing scope with the user, we deliberately narrowed to ONE subsystem, built
properly: **the Autonomous Substitution Engine** (recommendation scoring + fairness +
Manual/Assisted/Autonomous mode execution). Explicitly OUT of scope for this pass:
drag-and-drop timetable builder, dark mode/glassmorphism, WebSocket real-time sync
(decided to use polling instead, not yet implemented), command-center dashboard,
predictive operations, swap chains (multi-hop), self-healing engine.

User's answers that shaped this:
- Build the substitute engine, not the UI overhaul
- Skip WebSockets — polling is fine, simpler
- Build all 3 modes (Manual/Assisted/Autonomous), but the user was unsure on safety —
  Claude's call: hard eligibility rules (never assign someone on leave / already
  teaching / over their cap) are enforced in the engine itself regardless of mode;
  Autonomous mode executes without a click, Assisted mode stops at "recommend, admin
  clicks approve." Fresh installs default to "assisted" (not autonomous); a v3->v4
  migration on an *existing* install defaults to "manual" (conservative) instead.

## Files modified or created this session

### Backend — models
- `backend/app/models/leave.py` — added `AssignmentType` enum, `LeaveRequest.is_emergency`,
  and `AlterAssignment.assignment_type` / `.compatibility_score` / `.is_locked`
- `backend/app/models/substitution_preference.py` — **NEW**: per-teacher preferences
  (accept_auto_assignments, allow_emergency_assignments, max_weekly_substitutions,
  prefer_morning_classes, prefer_same_department)
- `backend/app/models/system_setting.py` — added `CAMPUS_OPERATIONS_MODES` shared
  constant (single source of truth, imported by both the service and the schema —
  see "Known issues" below, this was a deliberate fix for a near-circular-import smell),
  added `campus_operations_mode`/`emergency_window_hours` to `DEFAULT_SYSTEM_SETTINGS`
- `backend/app/models/__init__.py` — registered `AssignmentType`, `SubstitutionPreference`

### Backend — services
- `backend/app/services/substitution_service.py` — **NEW**, the core engine:
  - `get_mode` / `set_mode` — reads/writes `campus_operations_mode` system_setting
  - `get_or_create_preferences` / `update_preferences`
  - `fairness_score` — computed live from `alter_assignments`, NOT a separate
    running-counter table (deliberate: avoids reconciliation-job risk)
  - `_is_hard_eligible` — the rules that never bend (not self, active, not already
    teaching/on-leave/subbing that slot, opt-in respected only when
    `require_auto_opt_in=True`, weekly cap respected)
  - `list_eligible_candidates`, `score_candidate`, `get_ranked_recommendations`
  - `create_assignment` (public — was `_create_assignment`, renamed because
    `leave_service.py` calls it cross-module, see Known issues)
  - `auto_process_approved_leave` — the autonomous-mode executor, called from
    `leave_service.approve_leave`
  - `mark_emergency_if_applicable` — called at submission time in `leave_service.py`
- `backend/app/services/leave_service.py` — wired in:
  - `mark_emergency_if_applicable` call in both `submit_leave` and `submit_leave_batch`
  - `auto_process_approved_leave` call at the end of `approve_leave`
  - `assign_substitute` extended with `assignment_type`/`compatibility_score` kwargs
  - **NEW functions**: `override_substitute`, `undo_assignment`, `set_assignment_lock`
- `backend/app/services/factory_reset_service.py` — added `substitution_preferences` to
  `BACKUP_TABLES` and `_DELETE_ORDER`

### Backend — schemas
- `backend/app/schemas/leave.py` — added `is_emergency` to `LeaveOut`; added
  `assignment_type`/`compatibility_score`/`is_locked` to `AlterAssignmentOut`; added
  `OverrideSubstituteRequest`, `LockAssignmentRequest`
- `backend/app/schemas/substitution.py` — **NEW**: `RecommendationOut` (has
  `model_config = {"from_attributes": True}` — this was added after catching a real bug,
  see Known issues), `CampusOperationsModeOut`, `CampusOperationsModeSet`,
  `SubstitutionPreferenceOut`, `SubstitutionPreferenceUpdate`

### Backend — routes
- `backend/app/routes/leaves.py` — added `/recommendations`, `/assign-recommended`,
  `/override`, `/undo-assignment`, `/lock` endpoints (all under `/leaves/{leave_id}/...`)
- `backend/app/routes/campus_operations.py` — **NEW**: `GET/PUT /campus-operations/mode`
  (PUT is super-admin-only), `GET/PUT /campus-operations/preferences/me`,
  `GET /campus-operations/preferences/{teacher_id}` (admin, read-only)
- `backend/app/main.py` — registered `campus_operations` router

### Backend — preflight & migrations
- `backend/preflight_check.py` — added `substitution_preferences` to expected tables;
  added a new check #9 ("Verifying Autonomous Substitution Engine schema") that checks
  for the table and the 3 new `alter_assignments` columns, pointing at migration 004
  if missing
- `database/migrations/004_autonomous_substitution.sql` — **NEW**: adds the
  `assignment_type` enum, `leave_requests.is_emergency`, the 3 new `alter_assignments`
  columns (backfilled `admin_assigned` for pre-existing rows — see Known issues for why),
  `substitution_preferences` table, and the 2 new system_settings (defaulting
  `campus_operations_mode` to `'manual'` here specifically, NOT `'assisted'`)
- `database/schema.sql` — fresh-install schema updated to match: `assignment_type` enum,
  `leave_requests.is_emergency`, extended `alter_assignments`, new
  `substitution_preferences` table, new system_settings defaults (`'assisted'` here,
  since this is the fresh-install path)

### Frontend
- `frontend/src/api/services.js` — extended `leavesApi` with `recommendations`,
  `assignRecommended`, `overrideSubstitute`, `undoAssignment`, `setLock`; added
  **NEW** `campusOperationsApi` (getMode, setMode, myPreferences, updateMyPreferences,
  teacherPreferences)
- `frontend/src/components/icons.jsx` — added `LockIcon`, `UnlockIcon`, `UndoIcon`,
  `SparklesIcon`, `AlertTriangleIcon`
- `frontend/src/components/ui/index.jsx` — added `AssignmentTypeBadge` component
  (mirrors the existing `DayTypeBadge` pattern/style)
- `frontend/src/pages/admin/Leaves.jsx` — **REWRITTEN**: ranked recommendation panel
  (score bar + reasons) in the assign-substitute modal, emergency-leave warning icon,
  assignment-type badge + lock icon in a new "Substitute" column, override/undo/lock
  row actions

## Completed and verified

- All backend Python files syntax-check clean (`py_compile`)
- Cross-module `app.*` imports all resolve (custom AST-based checker, see below)
- Route -> service function references all resolve (custom AST-based checker)
- Frontend JS/JSX brace/paren/bracket balance check passes
- Frontend <-> backend route consistency check: **88 backend routes, 87 frontend calls,
  0 unmatched** (the 1-route gap is `/health`, which nothing calls from the frontend —
  expected)
- Caught and fixed a real bug before it shipped: `RecommendationOut` was missing
  `model_config = {"from_attributes": True}`, which would have caused a 500 error on
  `GET /leaves/{id}/recommendations` (Pydantic can't read a dataclass + nested ORM
  object without it). Fixed.
- Caught and fixed a layering smell: `leave_service.py` was calling
  `substitution_service._create_assignment` (leading underscore = private) across
  module boundaries. Renamed to `create_assignment` (public) and fixed both call sites.
- Caught and fixed a near-circular-import / duplicated-constant smell:
  `schemas/substitution.py` was importing `VALID_MODES` directly from
  `services/substitution_service.py` (schemas importing from services is backwards).
  Fixed by moving the single source of truth to `models/system_setting.py` as
  `CAMPUS_OPERATIONS_MODES`, imported by both the service and the schema.

## Known issues / things to double-check in a fresh session

**UPDATE (session 2): Issues #1 and #2 below have been verified and resolved.**
Issue #1 traced clean (no bug). Issue #2 uncovered a real, significant bug — see
"Bug found and fixed in session 2" below — which has been fixed. Issues #3-7 are
still open exactly as described.

### Bug found and fixed in session 2

**`LeaveOut` (in `backend/app/schemas/leave.py`) was missing the `alter_assignment`
field entirely.** Since `routes/leaves.py` builds every leave response via
`LeaveOut.model_validate(leave)` / `response_model=LeaveOut` (or `list[LeaveOut]`),
this meant `alter_assignment` was silently absent from every leave the API returned —
`GET /leaves/`, `GET /leaves/my`, the approve-leave response, bulk approve/reject,
undo-assignment, all of it. Practical impact: the rewritten `Leaves.jsx` already relied
on `leave.alter_assignment` in **11 separate places** (the Substitute column, the
lock/unlock/override/undo button states, and the "did autonomous mode already assign
someone?" check in `handleApprove`) — all of which would have silently misbehaved
(always showing "needs substitute" / always popping the assign modal, even when a
substitute already existed) the first time anyone actually ran the app.

Fixed by moving `AlterAssignmentOut` above `LeaveOut` in the same file (to avoid a
forward-reference) and adding `alter_assignment: AlterAssignmentOut | None = None` to
`LeaveOut`. Verified: full backend syntax/import/route-reference checks still pass
after the change; `AlterAssignmentOut`'s own fields were independently checked against
the `AlterAssignment` model and the `Candidate` dataclass (see below) and both match
exactly.

### Issue #1 — RESOLVED, no bug found
Traced `RecommendationOut` (backend) -> `leavesApi.recommendations()` (frontend) ->
`RecommendationRow` prop usage, field by field:
- Backend `Candidate` dataclass fields (`teacher`, `score`, `reasons`, `same_subject`,
  `same_department`, `workload_count`, `fairness`) match `RecommendationOut` exactly.
- Frontend only consumes `rec.teacher.name`, `rec.teacher.id`, `rec.score`,
  `rec.reasons` — all present and correctly typed. `same_subject`/`same_department`/
  `workload_count`/`fairness` are defined on the schema but not yet surfaced in the UI
  (not a bug — just available for a future richer display).
- `RecommendationOut.model_config = {"from_attributes": True}` (added last session)
  correctly allows Pydantic to read both the dataclass and the nested ORM `User`
  object through `UserOut` (which also has `from_attributes=True`).

### Issue #2 — RESOLVED (see "Bug found and fixed" above)
The original concern was whether `db.refresh(leave)` in `approve_leave` would pick up
a relationship populated by a separate function call (`auto_process_approved_leave`)
in the same session. Turned out not to matter either way: `leave.alter_assignment` is
never accessed anywhere in `approve_leave` before that point, so the relationship was
never prematurely cached — any later access (including Pydantic's serialization step)
triggers a fresh lazy-load against current DB state, which by then correctly includes
the row `auto_process_approved_leave` committed. The actual bug was one level up: the
*schema* didn't expose the field at all, regardless of whether the ORM had it loaded
correctly (which it did).

### Still open

~~3. No frontend UI yet for the Campus Operations Mode switch / Substitution
Preferences screen~~ — **DONE (session 3)**. Built:
- `CampusOperationsModePanel` in `pages/admin/Settings.jsx` — Manual/Assisted/Autonomous
  selector, read-only display for non-Super-Admins, confirmation modal specifically when
  switching TO Autonomous (every other transition only removes automation, so doesn't
  need a confirmation step), wired to `campusOperationsApi.getMode/setMode`.
- `pages/teacher/Preferences.jsx` (new) — toggle switches for
  accept_auto_assignments / allow_emergency_assignments / prefer_morning_classes /
  prefer_same_department, plus a number input for max_weekly_substitutions (blank =
  no cap), wired to `campusOperationsApi.myPreferences/updateMyPreferences`. Each
  toggle saves immediately on change (no separate Save button) except the numeric cap,
  which has its own Save button since it needs validation first.
- Routing: added `/teacher/preferences` to `App.jsx`, and a footer nav link in BOTH
  `Sidebar.jsx` (desktop) AND `MobileDrawer.jsx` (mobile) — the second one would have
  been a real gap if not checked explicitly, since `MobileDrawer` duplicates rather
  than reuses `Sidebar`'s footer markup.
- Verified: frontend balance/import checks pass; backend route-consistency check still
  88 backend / 87 frontend / 0 unmatched (no new API surface needed — reused existing
  `campusOperationsApi` methods from session 1).

4. **`User.department` is free text, not an FK** — `score_candidate`'s "same department"
   match compares this string against `Department.name` for the subject's department.
   This works as long as the strings agree (they should, since both ultimately come from
   the same Department list in the UI), but it's an approximate match, not a real join.
   Documented in the code; not a bug, just a pre-existing schema limitation to be aware of.
5. **Migration 004 backfills `assignment_type='admin_assigned'` for ALL pre-existing
   `alter_assignments` rows** — this is the only honest default (the autonomous engine
   didn't exist when those rows were created), but it means historical auto-like
   assignments (there weren't any, but conceptually) can't be distinguished after the
   fact. Not fixable; just documented in the migration's comments.
6. **No automated test suite exists anywhere in this project** — all verification so far
   has been static analysis (syntax checks, import resolution, route-matching) because
   this sandbox has no network access to actually `pip install`/`npm install` and run
   the app. This has been true for the whole project, not just this session.
~~7. Package not yet rebuilt/repackaged~~ — **DONE (session 3)**. See item 5 under
Next Steps above.

## Remaining work (in the original spec, explicitly not started)

- Drag-and-drop visual timetable builder (left sidebar draggable subject cards, center
  grid, right context panel, paint mode, bulk assignment mode)
- Dark mode / light mode toggle, glassmorphism, animations, 16px+ rounded corners pass
  across the whole app
- WebSocket (or polling-based) real-time sync across dashboards
- Unified/Command-Center substitution dashboard (single live table across the whole
  institution with inline filters or bulk row actions — current `Leaves.jsx` is
  per-leave-row, not a dedicated command-center view)
- Self-healing engine (alternate substitute -> swap -> room reassignment -> period
  reassignment escalation chain) — currently only does "find best single candidate,"
  no escalation/retry logic
- Auto-swap / multi-level swap chains
- Version history / "Regenerate Assignments" / "Restore Previous Version"
- Predictive operations ("tomorrow has high shortage risk" warnings)
- Reporting/analytics dashboard cards (Auto Processed Today, Conflicts Resolved, etc.)
- Audit/activity timeline UI (backend already logs everything via `log_audit_event` —
  e.g. `substitution.auto_assigned`, `substitution.overridden`,
  `substitution.autonomous_no_candidate`, `campus_operations.mode_change` — but there's
  no dedicated timeline screen surfacing these chronologically; the existing
  `AdminSettings` audit log panel shows raw entries, not a curated timeline)

## Next steps (recommended order)

1. ~~Re-verify `Leaves.jsx` <-> `RecommendationOut` field-by-field~~ — DONE (session 2)
2. ~~Verify `approve_leave`'s response shape supports `handleApprove`'s assumption~~ —
   DONE (session 2): found and fixed the missing `alter_assignment` field on `LeaveOut`
3. ~~Build the Campus Operations Mode switch in `pages/admin/Settings.jsx`~~ —
   DONE (session 3)
4. ~~Build the teacher Substitution Preferences screen~~ — DONE (session 3):
   `pages/teacher/Preferences.jsx`, routed at `/teacher/preferences`, linked from both
   desktop sidebar and mobile drawer footers
5. ~~Rebuild and repackage the tarball, run the full static-check suite one more time~~ —
   DONE (session 3): repackaged `credits-system.tar.gz` (126 files), independently
   re-extracted and spot-checked to confirm the new files/fixes are genuinely present
   (not a stale copy). Full suite re-run: backend syntax/imports/route-refs clean,
   frontend balance/imports clean, route consistency still 88 backend / 87 frontend /
   0 unmatched.
6. Re-discuss scope with the user for any of the "Remaining work" items above — each one
   is a substantial standalone effort, not a quick add-on
