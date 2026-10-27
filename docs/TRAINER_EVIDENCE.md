# Trainer evidence — Milestone 5

The architecture remains **User voice/text → ChatGPT virtual trainer → GymBro structured state/actions → persistent workout data → dashboard**, as defined in [GymBro_PRD.md](GymBro_PRD.md). ChatGPT supplies judgment; GymBro supplies inspectable evidence. Milestone 5 adds no autonomous trainer, AI/voice calls, workout screens or automatic prescriptions.

Start point: accepted main `817fc17` (PR #5), with production verified serving the Milestone 4 build. Application version is the canonical 2.5.0 build in `app-version.js`. **Data schema stays 7** and storage key remains `daveGymTrackerV1`. Nothing new is persisted, so no migration is required.

## API contract

Methods on the existing `workoutActions` interface:

```js
workoutActions.getExercisePerformanceContext({
  exercise: "Bench Press", // exact existing exercise-name key
  asOfDate: "2026-10-23", // explicit local calendar date, never browser now()
  unit: "lb", // optional: exact filter; no conversion
  limit: 5, // optional: recent occurrence display limit
  // excludeSessionId: "..." // optional: excludes that session from historical evidence
});

workoutActions.compareExercisePerformance({
  baselineSetId: "...",
  currentSetId: "...",
  asOfDate: "2026-10-23",
});

workoutActions.getTrainerWorkoutContext({
  asOfDate: "2026-10-23",
  // sessionId: "...", // defaults to existing active session
  // unit: "lb", limit: 5
});
```

All return `{ok, code, errors, result}` with detached, JSON-serializable output. Invalid dates/units/limits or missing referenced records return `VALIDATION_ERROR` and null result. Incompatible evidence is a successful inspection with `comparable: false` and structured reasons, not an invented comparison. Querying an unknown but valid exercise name returns no evidence, not a fabricated definition or history.

The factory registers selectors through `createPerformanceSelectors(getWorkoutState)`. Selectors have no persist/commit callback, DOM, current-clock dependency or mutations. The trainer workout selector calls the **same `guidedWorkoutState` implementation** used by `getGuidedWorkoutState`, on the detached snapshot. It does not reimplement position, statuses, substitutions, navigation or lifecycle. Existing action/transaction behavior is unchanged.

## Output and provenance

### Exercise context

- Exact exercise key/display name and original library definition when present; name-key identity is the existing model, not a new ID system.
- Recent occurrences with ordered full set records, set/session/slot/import references, original source metadata and import summaries.
- Planned versus actual exercise and whether that saved set represents a substitution; missing planned context is unknown. A later slot substitution does not relabel earlier sets.
- Session name/template, mode/status, slot status where recorded, creation metadata and authoritative set-order position.
- Latest numerically comparable evidence separately per unit. If multiple explicit sessions occur on the latest date, return them all with chronology ambiguity instead of choosing one by ID or creation time.
- Pain context with severity/area/notes, referenced records and age. Pain-area text alone is identified as context, not diagnosed as pain severity.
- Recorded exercise preference text, unparsed. Structured constraints are null; failure and working-set classification are unknown.
- Exclusions and reason codes, evidence-review status, limitations and a recent sequence. There is no trend score.

`recentOccurrences` defaults to the most recent five date/session evidence groups, with all matching records within each group. Explicit sessions retain `setIds` order. Legacy/sessionless groups retain stored order and are labelled `legacy_date_group`, with `legacyGroupingIsDisplayOnly: true`; no sessions are inferred or persisted. Same-date groups use stable key sorting for presentation only, marked `withinDateOrder: unknown` where more than one exists. Session creation time is not asserted as historical performance order.

The display limit does **not** become an evidence sufficiency or freshness rule. `evidenceReview` considers all matching records through asOfDate (after explicit unit/session exclusions); supporting IDs/counts identify that scope and follow occurrence presentation order with authoritative session set order. `lastComparableByUnit` also searches all matching eligible history. Older records remain available rather than expiring silently. Pain context is retained across matching history rather than discarded merely because it falls outside the display window.

### Trainer workout context

- `guidedWorkout`: the unchanged existing guided selector output, including active identity, snapshot/mode, current/planned/actual exercise, statuses, order, sets, remaining slots, previous/next and revision.
- `exerciseContext`: historical context for the current actual exercise, excluding the current session.
- `currentSlotSets`: all sets linked to the slot, including earlier actual exercises before a substitution.
- `currentActualExerciseSets` and `currentSessionExerciseEvidence`: exact-actual-exercise subsets without rewriting slot history.
- Current pain context and separately recorded planned/actual exercise preferences, unparsed.
- `structuredConstraints`/`structuredGoals`: null because the repository has no structured profile schema. No notes are parsed into medical limitations, goals or failures.
- A trainer-decision placeholder of `review` with `recommendation: null`, never a command or automatic workout mutation.

Unguided active sessions remain unguided and return `GUIDANCE_NOT_ENABLED`; no active session returns `NO_ACTIVE_SESSION`. Explicit completed session IDs can be inspected. These are successful state inspections, not automatic session creation or conversion.

## Approved policy: trainer-evidence-v1

This is evidence support, not progression programming. The only result categories are `review` and `insufficient_evidence`; there is no increase/maintain result or target generation.

| Policy item              | Exact rule                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimum evidence         | Two eligible records from distinct evidence occurrences **in the same unit** are needed for cross-occurrence numeric evidence sufficiency. Two legacy sets on one date do not become two workouts. Same-occurrence set comparisons may expose facts but do not satisfy cross-workout evidence. |
| Exercise identity        | Exact actual exercise-name key; no fuzzy matching or inferred equivalence. Metadata can be absent for a historical name without losing the record.                                                                                                                                             |
| Load units/equipment     | Exact supported unit; no conversions. Matching key/unit permits record arithmetic, not a claim that different physical machines are identical. Equipment identity is not recorded.                                                                                                             |
| Complete/incomplete      | Numeric comparison requires explicit complete=true, valid load/reps and an asOfDate not preceding the record. Incomplete records and missing values remain visible with exclusion reasons.                                                                                                     |
| Working sets             | No structured warm-up/working classification exists. Counts are called complete **recorded** sets, never qualified working sets.                                                                                                                                                               |
| Repetitions              | Use actual recorded positive whole-number reps. Unsafe integer precision is explicitly withheld. Never infer attempted or failed reps.                                                                                                                                                         |
| RPE                      | Preserve reports. Calculate a difference only at matching exercise/unit/load/reps, with both values present. No absolute readiness judgment or conversion.                                                                                                                                     |
| RIR                      | Same matched-workload rule, separately reported. Never convert to/from RPE or fill missing values.                                                                                                                                                                                             |
| Failure                  | The current schema has no defined structured failure field. Classification remains unknown. Preserve notes such as “failed rep 8” and all unknown source metadata without parsing them or prescribing a weight change.                                                                         |
| Pain/discomfort          | Report raw values, area, notes and IDs. Positive severity or nonempty pain area yields PAIN_CONTEXT_PRESENT and review, even when arithmetic is withheld. No diagnosis, training interpretation or future load change.                                                                         |
| Substitution             | Evidence belongs to the actual exercise. Preserve planned context; never credit it to another planned movement automatically.                                                                                                                                                                  |
| 30/60-minute mode        | Both qualify under identical record rules. Mode is context, not a quality penalty or separate progression policy.                                                                                                                                                                              |
| Old history              | Return exact calendar age using supplied asOfDate. No default cutoff; FRESHNESS_NOT_ASSESSED remains explicit.                                                                                                                                                                                 |
| Conflicting performances | Return ordered competing records and component differences, not a best-set winner or global improvement verdict. Same-date chronology may remain unknown.                                                                                                                                      |
| Bodyweight               | Preserve facts and recorded-rep totals; withhold external-load comparison arithmetic. Do not estimate effective system load from bodyweight history.                                                                                                                                           |
| Assisted exercises       | Preserve assistance/reps/notes. Do not treat assistance changes as external-load progression.                                                                                                                                                                                                  |
| Withholding              | Wrong exercise/unit, incomplete/missing/unsafe data, future records or unsupported load representation withhold numeric comparison with reasons. Unknown equipment/working/failure/freshness remain explicit limitations even when simple arithmetic is possible.                              |
| Imported/legacy          | Same factual rules as other sources; retain exact IDs/notes/metadata. Legacy date buckets are presentation evidence groups only.                                                                                                                                                               |
| Insufficient result      | Return status=insufficient_evidence, minimumComparableOccurrences=2, per-unit counts/supporting IDs, reason codes, limitations and recommendation=null. Pain context takes review precedence while retaining all insufficiency reasons.                                                        |
| Adequate result          | Return review plus supporting records and TRAINER_JUDGMENT_REQUIRED. Adequate record evidence does not establish readiness or an approved prescription.                                                                                                                                        |

No policy automatically modifies templates, future weights, active inputs, slot status, exercise selection, logged records or progression state.

## Calculations and explanations

`compareExercisePerformance` uses caller-selected record IDs. It does not cherry-pick a pair, select a “best” set or imply that the caller's baseline/current ordering establishes same-day chronology.

- **Same load:** current reps minus baseline reps.
- **Same reps:** current load minus baseline load.
- **Both changed:** expose both component deltas; mark `load_and_reps_changed` with `NO_GLOBAL_PERFORMANCE_RANKING`. There is no better/worse score.
- **Matched workload effort:** current RPE minus baseline RPE; independently current RIR minus baseline RIR. Missing reports return null difference/reason, not zero. Different workloads retain reported values but withhold effort-change interpretation.
- **Recorded totals:** per occurrence and exact unit, count complete records with valid load/reps and sum their recorded reps. Include supporting IDs, rule ID, `representsWorkingSets: false` and original records. An unsafe sum returns null with `UNSAFE_INTEGER_TOTAL` rather than silent overflow/rounding.
- **Age:** UTC-midnight arithmetic on two explicit local calendar-date strings divided by 86,400,000. This counts calendar days without a runtime clock or DST ambiguity.

Each pair calculation includes metric, numeric value, unit, ruleId, `operation: current - baseline`, and both `{setId, value}` operands. The result includes full baseline/current evidence, comparability reasons, relationship, chronology/scope, effort, review result and limiting factors. Ordinary numeric arithmetic uses JavaScript numbers; no physiological model, unit conversion, normalization score or estimated 1RM is added.

### Existing dashboard metrics — unchanged, not progression policy

- `volume(set)` is recorded weight × reps for complete sets; it is not physical work, strength, readiness or workout quality.
- `performanceRows(exercise)` selects complete positive external-load records, excludes assisted/bodyweight, then uses the unit of the latest eligible record.
- `bestByDate(exercise)` chooses highest eligible set-work per date. This existing chart can combine same-date sessions for display; Milestone 5 does not reuse it as evidence occurrence identity.
- `renderGains()` compares earliest/latest eligible date’s best set-work: `(last - first) / first × 100`. It is not a progression prescription and may reflect rep/load tradeoffs and differing coverage.

Milestone 5 does not call these metrics for its evidence decisions or change their existing UI. Raw referenced observations and explicit subtraction/sums replace opaque progression scores in the new API.

## Validation and physical-iPhone acceptance

Automated tests cover DOM-free composition, deterministic/detached output, no writes or commits, exact identity/units, modes, substitutions, same-date uncertainty, imports/legacy groups, incomplete data, effort, pain, failure/warm-up notes, preferences/absence, historical age, unsafe totals, backup reproducibility and all existing guided/manual/persistence regressions.

No new workout interaction screen or analytics dashboard is introduced. The normal UI shows the canonical 2.5.0 build. Existing guided previous-performance presentation remains unchanged; the new APIs are the trainer-facing consumer surface.

Before manual persistence checks, **export production JSON and verify the file**. Use the milestone preview and disposable data or a deliberate copied backup.

1. Verify the footer’s exact 2.5.0 build and normal Safari loading, with all tabs still available.
2. Start/resume a test guided workout, log a set, navigate/Done/Skip, substitute and finish with the existing confirmations. Manual logging must remain available.
3. Reload/background/reopen and confirm committed progress/history survives. Check one-handed/keyboard usability has not changed.
4. Export/restore/export JSON on the preview; schema must remain 7 with original session/guidance/metadata and no persisted derived evidence or progression state. Verify file handling on iPhone.
5. Optional Safari Web Inspector: call `workoutActions.getTrainerWorkoutContext({asOfDate:"2026-10-23"})`. Compare `result.guidedWorkout` with the existing guided selector and inspect references/unknowns. Repeated calls must not write storage or change the workout. Do not claim this API check was physically performed without Inspector access.
6. Record actual device/iOS/browser/build and failures in `REAL_PHONE_SMOKE_TEST.md`. Automated Chromium is not physical Safari acceptance.

## Limits intentionally retained

Exercise and equipment identity retain existing name-key limitations. There is no structured failure/working-set/profile schema, inferred classification, stale cutoff, trend score or positive progression recommendation. Detailed old notes and source metadata are preserved for trainer interpretation, not classified by GymBro. The APIs scan selected-exercise history and return bounded recent groups plus relevant supporting IDs/pain evidence; large histories may warrant later performance work. No evidence cache, backend, new dependency or persistence subsystem is added. Milestone 6 remains separate work.
