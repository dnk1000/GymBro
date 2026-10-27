# GymBro V3 implementation planning baseline

Status: proposed for user review, October 27, 2026. Planning only; no feature implementation, architecture, database design or deployment change is authorized by this document.

## Baseline and PRD review

Continue the existing Windows checkout, GitHub repository and Vercel project from main commit `ffd556e154ec19752c9f44031a95890d5954f200`, after PR #13. Application version is `2.7.2-20261027T152907Z`; workout data schema is 7. Refresh these facts before generating an implementation prompt. Do not revive the abandoned PR #9 implementation or create another development environment.

Sources: [PRD](GymBro_PRD.md), [compliance audit](PRD_COMPLIANCE.md), [release record](V2_RELEASE.md), [physical-phone acceptance](REAL_PHONE_SMOKE_TEST.md), [Supabase checkpoint](SUPABASE_CONNECTION_TEST.md), and the root [README](../README.md) and [project rules](../AGENTS.md).

The PRD's current-scope section preserves the standalone V2 product and labels external AI/voice integration optional and unscheduled. Its historical sections 27–43 describe a broader end state: a conversational trainer operating GymBro during a real workout. This plan proposes a staged route toward that end state; approving a storage milestone does not approve the later trainer milestones.

Implemented foundations include sessions, guided workouts, action/state contracts, factual performance context, History, corrections, backups and manual ChatGPT interchange. Local browser storage still holds workout data. The Supabase diagnostic proves one isolated value can be saved/read; it does not prove account recovery, workout migration, cross-device operation or production persistence.

The compliance audit records two functional gaps: persisted temporary exercise reordering and adaptation of an already-active workout's duration/remaining plan. Physical iPhone evidence, verified personal backup evidence and final V2 acceptance remain incomplete in the records. Some release-record rows are stale: PR #12 and PR #13 have now merged. Distinguish missing documentation from missing functionality; do not repeat completed deployment work or declare unrecorded device tests passed.

## Proposed scope and sequencing

Make cloud persistence the first major delivery phase, with separate reviewable milestones for identity, migration and local-storage retirement. Keep workout behavior stable during that phase. Supabase becomes the sole authoritative workout store after accepted cutover; do not keep indefinite dual writes or an automatic local-only fallback.

The migration must preserve the complete dataset: sets, bodyweight, program, exercise library, preferences, imports and duplicate protection, sessions, original plan snapshots, active guidance, request history, IDs, dates, units, notes, pain and completeness. Legacy records stay legacy records.

Recommended initial connectivity policy: require connectivity to confirm a saved change. Preserve visible unsaved input on failure and provide a deliberate retry; never report a set as saved until durable storage acknowledges it. This is a proposal to approve before migration work. If offline workout logging is essential, resolve that requirement first; it materially changes scope. Manual use independent of AI remains required, but does not imply offline persistence.

Retiring localStorage means retiring it as a workout database. Decide separately whether browser storage used for sign-in or harmless preferences is allowed; do not confuse authentication persistence with a second workout store. Do not automatically delete the old local dataset during initial migration. Retain it only as inactive recovery material until verified cloud migration and an explicit cleanup decision.

Use milestone IDs below independently of product version numbers. The PRD uses 3.x for the trainer generation and minor versions for milestones. Agree the numbering before changing release tooling. A cloud-storage checkpoint is not completion of the PRD's full V3 trainer definition.

## Milestones

### M0 — Confirm V3 scope and baseline acceptance

Outcome: an approved scope and acceptance checklist suitable for generating the first feature prompt.

- Reconcile stale release evidence against accepted main without rewriting historical records.
- Record actual iPhone results and a verified complete production JSON backup, or obtain explicit disposition of remaining V2 acceptance items.
- Confirm recoverable sign-in, single-user scope initially, Preview/Production data separation, connectivity behavior, local-storage retirement meaning and release numbering.
- Approve cloud persistence as the first phase; leave conversation/voice conditional until their scope is approved.

Acceptance: each decision and remaining gate has a recorded disposition; current instructions no longer conflict with the approved next milestone. No implementation or architecture in this milestone.

Suggested development model: **GPT-6 Astra, high reasoning**, for reconciling product requirements and conflicting historical records.

### M1 — Recoverable user access and private data ownership

Depends on M0. Outcome: the same person can access their own GymBro account from another browser/device.

- Provide a simple sign-in/sign-out and recovery experience suitable for iPhone.
- Demonstrate separation between users and between disposable Preview testing and actual Production workout data.
- Verify access after closing the browser, signing out and returning on a second device. Do not treat the diagnostic's anonymous test identity as an accepted long-term account.
- Preserve existing workout behavior while account access is tested; do not move or remove personal workout data yet.

Acceptance: repeatable manual account recovery and second-device access; one test user cannot read or change another's data. Provide Preview instructions requiring no secret sharing.

Suggested development model: **GPT-6 Astra, high reasoning**, because access recovery and data isolation require careful review.

### M2 — Full workout persistence and migration on Preview

Depends on M1. Outcome: a deliberate test copy of the complete existing dataset operates through Supabase with existing GymBro functionality intact.

- Migrate explicitly selected local data or a verified complete backup; do not upload personal history merely by opening a Preview.
- Exercise every persisted workflow: manual/guided logging, edits/deletes, program/library/preferences, bodyweight, session recovery, imports, full restore, history merge and exports.
- Compare complete content and relationships before/after migration, not just record counts. Repeated or interrupted migration must not duplicate records or destroy a pre-existing destination dataset.
- Test rejected writes, connection loss, retries, expired access, stale views and simultaneous-device changes. A delayed response must not cause duplicate logging or overwrite newer work silently.
- Preserve existing JSON interchange and backup compatibility unless an explicit documented change is approved.

Acceptance: complete data comparison passes; an active workout survives reload and second-device access; failed saves preserve input and existing committed data; no live Production migration yet.

Suggested development model: **GPT-6 Astra, extra-high reasoning**, for the highest data-integrity and regression burden.

### M3 — Controlled cutover and local workout-storage retirement

Depends on accepted M2 and explicit production rollout approval. Outcome: Supabase is the sole active workout store.

- Rehearse cutover and recovery using disposable data before the approved personal-data transition.
- Verify the actual retained backup and the accepted cloud dataset before ending local workout reads/writes.
- Remove the supported local-only workout mode and automatic local fallback. Keep any remaining legacy importer narrowly defined; it must not become a competing active database.
- Demonstrate continued operation in a fresh browser with no legacy workout key, and after sign-out/sign-in. A cloud load failure must not appear as an empty account or trigger reseeding.
- Record the treatment of the inactive legacy copy. Do not delete it silently.
- Define recovery for writes made after cutover; reverting app code alone must not strand newer cloud workouts.

Acceptance: all normal workout workflows use cloud data; cross-device changes are visible after deliberate refresh/reopen; physical iPhone checks and approved production smoke results are recorded.

Suggested development model: **GPT-6 Astra, high reasoning**, for cutover, recovery and verification of local-storage retirement.

### M4 — Complete live-workout adaptation

Depends on M3. Outcome: workouts can adapt to time and equipment without rewriting history. Covers PRD sections 18–19 and the two documented functional gaps.

- Persist temporary exercise reordering and changes to the remaining plan/duration during an active workout.
- Preserve original intent, completed sets, actual substitutions and permanent templates unless a separate permanent edit is requested.
- Retain explicit skip, finish, manual fallback and clear remaining-workout state.

Acceptance: start a 60-minute workout, log sets, shorten the remaining session, reorder an occupied exercise, substitute another, reload and verify both original context and actual performance.

Suggested development model: **GPT-6.1 Sol, high reasoning**, for focused extension of the existing workout behavior.

### M5 — Trainer context and factual questions

Depends on M4 and separate approval of trainer integration. Outcome: the trainer can understand the user and answer from actual GymBro records before receiving permission to change workouts.

- Let the user record and correct goals, available equipment, schedule, preferences and relevant limitations. Retain existing free text and unknowns; do not infer medical facts or classifications from old notes.
- Answer historical questions from PRD section 35 with identifiable supporting records, units, dates and explicit uncertainty.
- Expose current workout position and remaining work accurately. Questions must not mutate workouts or invent historical sessions.
- Before implementation, confirm the intended user experience: regular ChatGPT conversation/voice or a GymBro-hosted trainer. Verify that the selected experience supports the required behavior; do not assume ordinary ChatGPT voice can operate GymBro.

Acceptance: a fixed question set matches known test records; missing/ambiguous history is disclosed; the trainer cannot change data in this milestone.

Suggested development model: **GPT-6.1 Sol, high reasoning**, for bounded product integration and evidence-based acceptance cases.

### M6 — Conversational workout control and automatic logging

Depends on M5. Outcome: a text conversation can operate a complete workout reliably before voice is added. Covers PRD sections 29, 31–32 and 36–37.

- Support start/resume, current/next, set logging, explicit corrections, skip, substitution and finish.
- Interpret examples such as “12 clean, seven out of ten,” “same weight” and “got 10 with two left” against known workout context.
- Clarify ambiguous load, unit, exercise or deletion targets; keep routine unambiguous logging low friction.
- Confirm success only after the actual change is saved. Repeated messages, reconnects and interrupted replies must not duplicate sets or falsely report success.
- Preserve manual correction and the existing reviewed JSON Inbox.

Acceptance: a scripted full text workout produces exactly the expected saved records, including clarification, correction, replay and failure cases.

Suggested development model: **GPT-6 Astra, extra-high reasoning**, for contextual interpretation, state changes and reliable failure handling.

### M7 — Adaptive coaching and deliberate program evolution

Depends on M6. Outcome: the trainer recommends and applies appropriate user-approved workout changes using actual evidence. Covers PRD sections 2, 33–34.

- Support initial split proposals and revisions for goals, schedule, equipment and user preferences.
- Adapt remaining work for available time, equipment, reported discomfort and performance; explain the evidence behind suggested loads/repetitions and progression.
- Distinguish advice from recorded performance, session-only changes from permanent changes, and uncertainty from established facts.
- Require clear user intent before changing the permanent program; never rewrite prior session snapshots or infer missing performance.

Acceptance: scenario-based review covers onboarding, learning-phase changes, a shorter session, travel equipment, discomfort, sparse evidence and a permanent program revision. Suggestions remain distinguishable from completed work.

Suggested development model: **GPT-6 Astra, high reasoning**, for broad context, nuanced decisions and adversarial scenario review.

### M8 — Voice workout experience on iPhone

Depends on M7 and verification that the chosen conversational experience supports the intended voice workflow. Outcome: the accepted conversational workout can be performed by speaking with minimal phone interaction.

- Test earbuds, music, interruptions, misunderstood numbers, corrections, reconnection, backgrounding and phone locking on the actual target device.
- Retain text/manual fallback and an unmistakable distinction between heard, interpreted and successfully saved results.
- Validate the PRD's intended ChatGPT voice experience if that experience was selected. Record actual limitations; do not silently substitute another product experience or claim unsupported locked-phone operation.

Acceptance: a real iPhone workout is recorded accurately; device/browser/version and limitations are documented. UI emulation alone cannot pass this milestone.

Suggested development model: **GPT-6 Astra, high reasoning**, for the integration and interruption/recovery cases. Physical acceptance requires the human tester.

### M9 — V3 release acceptance and handoff

Depends on all milestones included in the agreed release scope. Outcome: a demonstrated, supportable release with an accurate PRD compliance record.

- Recheck complete historical data, account recovery, cross-device operation, backups, failed saves and absence of active local workout persistence.
- Run the complete regression suite and hosted checks; record Preview and approved Production acceptance separately.
- Demonstrate the full accepted trainer journey: start, recall previous performance, log, adapt, correct, finish and review the saved session.
- Record remaining limitations, rollback/recovery instructions and physical iPhone results. Declare full PRD V3 complete only if the agreed conversational/voice success criteria are met.

Acceptance: user accepts the recorded outcomes and explicitly approves production delivery. Missing physical or personal-data evidence stays pending.

Suggested development model: **GPT-6.1 Sol, high reasoning**, for systematic verification and release documentation; use Astra for unresolved complex defects.

## Boundaries for every future milestone prompt

Each prompt should identify the current accepted main revision, approved milestone and dependencies; concrete user-visible behavior; preserved behavior and data; explicit exclusions; acceptance scenarios; automated and manual verification; and required branch, PR and Vercel Preview evidence. Include any necessary data transition and recovery acceptance without prescribing architecture in this baseline.

Use the same repository, checkout and Vercel project. Keep each milestone independently reviewable; split an oversized milestone into named substeps rather than combining migration, coaching and voice in one PR. No unsolicited UI redesign, framework rewrite, social features, nutrition system or general health record. No merge or production data change without the applicable user approval. Do not treat approval of this planning document as approval of every future milestone.

## Model recommendation basis

These are recommended models for the development agent implementing each milestone, not runtime trainer or speech-model selections. Recommendations reflect task complexity and are judgment calls, not performance guarantees. Recheck availability when generating each prompt.

Official OpenAI documentation positions GPT-6 Astra for demanding reasoning/coding and GPT-6.1 Sol for complex work with a balance of quality, time and cost: [model catalog](https://developers.openai.com/api/docs/models), [model selection](https://developers.openai.com/api/docs/guides/model-selection). Access and available reasoning settings depend on the product/account. No application AI-provider, runtime-model or voice technology choice is made here.
