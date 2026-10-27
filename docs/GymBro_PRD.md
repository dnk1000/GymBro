# GymBro Product Requirements Document

**Product:** GymBro  
**Document Version:** 1.1  
**Date:** October 23, 2026  
**Primary Platform:** iPhone / Safari  
**Repository:** `dnk1000/GymBro`  
**Deployment:** GitHub → Vercel  
**Product Versioning:** `MAJOR.MINOR.PATCH-BUILD`

---

# Current product scope and authority

October 27, 2026 M0 decision: the user approved staged cloud persistence as the first V3 phase, beginning with separately requested recoverable personal access on Preview, then verified full migration and controlled local workout-storage retirement. See [the M0 decisions and acceptance gates](V3_M0_SCOPE_AND_ACCEPTANCE.md). Initial cloud saves require connectivity; existing features/data remain preserved. The two live-workout adaptation gaps are assigned to M4. Physical-iPhone and personal-backup evidence is deferred through M1 Preview-only work and required before M2 migration testing. This approved roadmap supersedes the older standalone-only direction for the specifically requested milestone; it does not describe shipped cloud functionality or authorize all later milestones. Trainer/conversation/voice work remains separately scoped and conditional.

This section records the current approved product direction and supersedes the external integration schedule and hosting assumptions in the original vision below. The original document metadata, numbered roadmap and milestone descriptions are retained as historical design context; they are not evidence that a feature shipped or a new authorization to implement it.

The present focus is the standalone GymBro application developed from the GitHub repository and delivered through Vercel. GitHub `main` is the single authoritative source. New work starts from freshly fetched `main` on a Git branch, is reviewed in a GitHub pull request, runs GitHub CI, and is exercised through Vercel previews. Only an explicitly approved merge to `main` advances the existing production deployment. Developer checkouts are working copies, not independent application authorities or hosted runtimes.

Preserve accepted V2 behavior: localStorage persistence, workout actions and sessions, guided workouts, trainer evidence/context, History, backup/restore, import/export, manual ChatGPT Inbox/interchange, current UI, versioning and regression coverage. No provider account is needed to use those features.

External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** No Supabase/PostgreSQL backend, OAuth, MCP, external trainer API, provider connection or ChatGPT-hosted/provider-hosted GymBro environment is part of the active architecture. The unmerged implementation in [PR #9](https://github.com/dnk1000/GymBro/pull/9) was an experiment and is abandoned; its branch is retained temporarily as historical reference, not a parallel baseline. Do not revive or merge it. Any future reconsideration needs a separately approved scope.

The historical product vision, conceptual V3 generation and AI/voice examples below remain ideas only. They must not be read as committed near-term delivery work. Existing acceptance gaps for V2 are not resolved by this change of direction.

# 1. Historical Product Vision

GymBro exists to enable a **frictionless virtual personal trainer**.

The mature GymBro experience should require almost no manual interaction with the application during a workout.

The user should be able to open a live ChatGPT conversation, say something as simple as:

> “I’m at the gym. Let’s get some.”

GymBro and the virtual trainer should already know:

- the user's goals,
- normal training split,
- recent workout history,
- current working weights,
- progression trends,
- physical limitations,
- pain/discomfort history,
- exercise preferences,
- available time,
- relevant substitutions,
- and what should happen next.

The trainer should then:

1. Determine the appropriate workout.
2. Adapt it to the time available.
3. Coach the user exercise by exercise.
4. Recall previous performance.
5. Recommend weights and repetitions.
6. Record results from natural conversation.
7. Adjust the workout when equipment, pain, fatigue, or time requires it.
8. Preserve the complete workout automatically.
9. Use the new workout history to improve future coaching.

GymBro itself is primarily the **structured memory, control layer, and dashboard** supporting that experience.

It is not intended to become a traditional fitness application with an AI feature added later.

---

# 2. North Star User Experience

The target experience is modeled directly on the workflow that has already proven useful in live ChatGPT coaching.

## Initial Setup

The user tells the trainer:

- training goals,
- desired weekly frequency,
- age and relevant context,
- physical limitations,
- injuries or pain considerations,
- exercise preferences,
- available equipment,
- and other relevant constraints.

The trainer generates an initial workout split.

## Learning Phase

During the first several workouts, the trainer walks the user through each session.

Together they establish:

- appropriate exercises,
- useful substitutions,
- working weights,
- repetition ranges,
- effort levels,
- equipment preferences,
- tolerable ranges of motion,
- and any pain-related modifications.

The plan evolves based on what actually happens in the gym.

## Established Routine

Once the program has stabilized, the interaction becomes extremely simple.

The user arrives at the gym and says something equivalent to:

> “I’m at the gym. Let’s get some.”

The trainer knows the normal split and recent history and begins coaching the session.

If the user says:

> “I only have 30 minutes today.”

the trainer automatically reprioritizes the workout.

During the workout, the user may say:

> “12 clean, seven out of ten.”

> “Got 10, two in reserve.”

> “My shoulder twinged.”

> “That machine is busy.”

> “Same weight.”

> “Give me something else.”

The trainer interprets those statements in the context of the active workout, updates the plan as needed, and GymBro records the structured data automatically.

---

# 3. Product Roles

GymBro has three distinct responsibilities.

## 3.1 ChatGPT / Virtual Trainer — The Brain

The trainer is responsible for:

- understanding the user's goals,
- creating the workout split,
- deciding what workout is appropriate,
- coaching the active workout,
- interpreting natural-language feedback,
- adapting the session,
- making progression decisions,
- accounting for known limitations,
- and explaining recommendations when asked.

The AI trainer is the intelligence layer.

## 3.2 GymBro — Memory, Controls, and Dashboard

GymBro is responsible for:

- storing workout templates,
- storing workout sessions,
- storing sets and performance,
- tracking relevant bodyweight data,
- storing exercise substitutions,
- storing workout-related discomfort/pain notes,
- exposing reliable workout actions,
- maintaining workout state,
- preserving history,
- and displaying useful trends and summaries.

GymBro is the system of record.

## 3.3 Voice / Conversation — Primary Future Interface

The eventual preferred workout interface is live conversation.

The user should be able to train with earbuds in and interact with the virtual trainer primarily through voice.

The GymBro visual interface remains available for:

- reviewing workouts,
- correcting data,
- inspecting trends,
- viewing the program,
- backup/restore,
- and manual fallback.

It should not be necessary for normal set-by-set interaction.

---

# 4. Product Decision Filter

Every proposed GymBro feature should answer at least one of these questions:

1. **Does this make the virtual trainer smarter?**
2. **Does this make interacting with the trainer easier?**
3. **Does this make the resulting workout data easier to understand?**

If the answer to all three is no, the feature should normally remain out of scope.

This requirement exists specifically to prevent GymBro from becoming an oversized general-purpose fitness application.

---

# 5. Product Goals

GymBro shall:

- Make starting a workout nearly effortless.
- Maintain enough structured history for the trainer to understand prior performance.
- Support generation and evolution of a stable training split.
- Allow the trainer to modify workouts dynamically.
- Support approximately **60-minute standard workouts**.
- Support abbreviated **approximately 30-minute workouts**.
- Track actual performance at the set level.
- Preserve workout context at the session level.
- Support explainable progression.
- Preserve historical workouts accurately.
- Support exercise substitutions without corrupting the underlying program.
- Account for workout-related pain and limitations.
- Work well on an iPhone in a real gym environment.
- Remain useful while traveling or using unfamiliar gyms.
- Expose clean structured actions that conversational AI can call.
- Eventually support nearly hands-free live voice operation.

---

# 6. Non-Goals

GymBro is not intended to become:

- a social fitness network,
- a bodybuilding encyclopedia,
- a marketplace,
- a calorie-counting ecosystem,
- a generalized health-record system,
- a massive exercise-content library,
- a complex workout-programming spreadsheet,
- or a standalone rules engine attempting to replace the virtual trainer.

Complex features should not be added merely because conventional fitness applications contain them.

The core value is the virtual trainer experience.

---

# 7. Core Training Model

GymBro maintains a regular training split composed of a stable collection of core exercises.

The trainer may initially generate the split and later modify it based on actual workout results.

The workout template defines the current normal program.

An individual workout session records what actually happened.

Example:

**Template**

Pull workout → Seated Row

**Actual session**

Pull workout → Hotel Cable Row

The substitution belongs to the workout session unless the trainer or user intentionally changes the permanent program.

GymBro therefore requires separate concepts for:

- Workout templates
- Exercises
- Workout sessions
- Exercise substitutions
- Sets
- Bodyweight
- Performance history
- Workout-related pain/discomfort
- Trainer-relevant preferences and constraints

---

# 8. Workout Duration Modes

GymBro supports two primary workout modes.

## Standard Workout

Target duration:

**Approximately 60 minutes**

This represents the normal complete session.

The duration is a planning target, not a timer guarantee.

## Short Workout

Target duration:

**Approximately 30 minutes**

The short workout is an intelligently prioritized version of the planned workout.

It is not simply the first half of the full workout.

The virtual trainer should retain the highest-value work while removing or reducing lower-priority accessories.

The same workout history and progression data remain valid across both modes.

---

# 9. VERSION 1 — GymBro Dashboard / Workout Tracker

## 9.1 Objective

Version 1 establishes the basic GymBro application and proves the workflow.

The V1 goal is:

> Provide a simple mobile dashboard and structured workout log for workouts being coached conversationally.

V1 does not attempt to replace the conversational trainer.

It gives the trainer's workouts a durable home.

## 9.2 Core Capabilities

Version 1 provides:

### Workout Program

The application stores the user's regular workout split and core exercises.

### Standard and Short Workouts

GymBro recognizes approximately:

- 60-minute normal workouts
- 30-minute abbreviated workouts

### Set Logging

The user can record:

- exercise,
- load,
- unit,
- repetitions,
- RPE,
- RIR,
- notes,
- pain/discomfort,
- completion information.

### Workout History

Previous performance can be reviewed.

### Manual Entry

The user can manually add or correct workout information.

Manual control remains important as a fallback even after conversational automation exists.

### Import / Export

Workout data can be exported and imported.

JSON is the canonical structured format.

CSV may be supported for analysis.

### Bodyweight Tracking

Bodyweight may be tracked independently from workout sets.

### Basic Performance Display

V1 may show simple exercise-performance comparisons and workout history.

The goal is visibility, not advanced physiological modeling.

---

# 10. V1 Interface and Technology

The primary interface is optimized for iPhone Safari.

Design goals:

- large touch targets,
- low friction,
- minimal typing,
- fast set entry,
- readable history,
- useful workout summary.

The established visual identity is:

**Black-and-white vintage strongman / nineteenth-century woodblock style.**

V1 uses:

- HTML
- CSS
- Vanilla JavaScript
- Browser `localStorage`
- JSON / CSV import/export
- GitHub
- Vercel

V1 does not require:

- backend infrastructure,
- user accounts,
- cloud database,
- authentication,
- or direct AI integration.

---

# 11. V1 Limitation Driving V2

V1 records useful workout data but does not fully model the active workout as a durable first-class object.

That creates limitations for:

- reliable session recovery,
- active workout context,
- automatic logging,
- conversational control,
- substitutions,
- session-level history,
- workout-state queries,
- and voice integration.

Version 2 exists primarily to solve those architectural problems.

---

# 12. VERSION 2 — Trainer Infrastructure

## 12.1 Objective

Version 2 should not attempt to turn GymBro into a large standalone training application.

Its purpose is:

> Build the reliable workout state, actions, history, persistence, and APIs required for ChatGPT to operate GymBro as a virtual trainer.

V2 is therefore primarily infrastructure for the eventual frictionless trainer experience.

The test for a V2 feature is not:

> “Would a fitness app normally have this?”

It is:

> “Does the virtual trainer need this to coach and record a real workout reliably?”

---

# 13. V2 Architectural Principle

Workout logic must be accessible independently of visual UI elements.

The trainer should eventually be able to call the same structured actions that the user currently triggers with buttons.

Representative actions include:

- start workout
- resume workout
- select workout mode
- log set
- edit set
- delete set
- retrieve exercise history
- retrieve workout state
- record pain
- skip exercise
- substitute exercise
- reorder exercise
- finish workout
- record bodyweight

UI, text, and voice interfaces should all call the same action layer.

The DOM must not be the application's source of truth.

---

# 14. Workout Sessions

Version 2 introduces a first-class **Workout Session**.

A session may include:

- Session ID
- Workout/template ID
- Date/time
- Duration mode
- Status
- Plan snapshot
- Exercise order
- Exercise substitutions
- Ordered sets
- Session notes
- Start time
- Completion time
- Source/import metadata

Possible session states include:

- active
- completed
- abandoned

An active session must survive normal mobile-browser behavior such as refresh, backgrounding, and phone locking.

---

# 15. Plan Snapshots

When a workout begins, GymBro stores the workout plan used for that session.

This allows the trainer to modify the permanent program later without rewriting history.

Historical workout truth must remain intact.

---

# 16. Set Model

Each set may record:

- Exercise ID
- Session ID
- Set order
- Load
- Unit
- Repetitions
- RPE
- RIR
- Notes
- Pain/discomfort
- Timestamp
- Completeness
- Source metadata

Historical pre-session records remain valid.

GymBro should not fabricate historical sessions merely to make old data look cleaner.

---

# 17. Guided Workout State

V2 should maintain enough state for the trainer to know:

- which workout is active,
- which exercise is current,
- which exercises are complete,
- what sets have already been performed,
- what the previous relevant performance was,
- what substitutions have occurred,
- which exercises remain,
- and whether the session is standard or short.

The UI may display this information, but its main purpose is to make the workout understandable to the future conversational trainer.

---

# 18. 30-Minute / 60-Minute Adaptation

Workout duration is part of structured workout state.

The trainer must be able to switch or create a plan appropriate for:

- approximately 60 minutes,
- approximately 30 minutes,
- or potentially less time during a live session.

GymBro should support the resulting plan and record what was actually performed.

The trainer, not a rigid timer, decides how to reprioritize the workout.

---

# 19. Exercise Substitution and Reordering

Real gyms are dynamic.

The user may encounter:

- occupied equipment,
- missing equipment,
- hotel-gym limitations,
- discomfort,
- fatigue,
- or simple preference.

GymBro must allow the trainer to:

- temporarily reorder exercises,
- substitute an exercise,
- skip an exercise,
- and preserve the original plan for historical context.

A one-session substitution must not automatically alter the permanent workout template.

---

# 20. Pain and Limitation Awareness

Workout-related pain/discomfort is a first-class input.

GymBro can store:

- affected exercise,
- relevant body area,
- user-reported severity/context,
- notes,
- and resulting substitution or modification.

The virtual trainer may use this history when adapting future workouts.

GymBro is not a diagnostic medical system.

Its role is to preserve training context accurately.

---

# 21. Session History and Recovery

V2 must support:

- active-session recovery,
- completed-session history,
- session details,
- historical corrections,
- legacy records,
- and prevention of accidental duplicate sessions.

If GymBro is reopened during an active workout, the session should be recoverable.

---

# 22. Backup, Restore, and Import

## Backup / Restore

A backup should preserve the complete GymBro state, including:

- sessions,
- active session,
- sets,
- bodyweights,
- workout templates,
- exercise library,
- preferences,
- and required metadata.

## History Import

History import adds compatible workout records to an existing installation without overwriting unrelated configuration.

These are distinct operations.

---

# 23. Progression Support

The trainer ultimately decides progression.

GymBro's job is to provide reliable structured evidence.

Relevant information may include:

- previous load,
- repetitions,
- RPE,
- RIR,
- failures,
- recent performance,
- pain/discomfort,
- prior substitutions.

Any deterministic recommendation logic implemented inside GymBro should be:

- transparent,
- explainable,
- conservative,
- and subordinate to the trainer's broader reasoning.

GymBro should not create a competing hidden coaching system.

---

# 24. V2 Application State API

V2 should expose detached structured state such as:

`getWorkoutState()`

It should describe the active workout without requiring interpretation of HTML.

Actions should return structured results.

Data should be persisted before an action is reported as successfully committed.

This action/state layer is one of the most important deliverables of Version 2.

---

# 25. V2 Scope Control

V2 should avoid unnecessary standalone-app complexity.

Features such as the following should only be added when they directly support the virtual trainer or dashboard:

- elaborate manual program builders,
- extensive standalone workout scheduling,
- large exercise encyclopedia features,
- complex analytics dashboards,
- social features,
- gamification,
- unrelated wellness tracking.

V2 is successful when the trainer can reliably understand and modify workout state.

It does not need to imitate every feature of commercial fitness applications.

---

# 26. V2 Milestones

## V2.1 — Action/UI Separation

Purpose:

Separate workout actions from DOM-specific implementation.

Status:

**Implemented and accepted.**

---

## V2.2 — Explicit Workout Sessions

Purpose:

Create first-class workout sessions and compatible persistence.

Includes:

- session IDs,
- session status,
- active session,
- plan snapshot,
- set/session relationships,
- persistence,
- legacy compatibility.

Branch:

`v2/milestone-2-workout-sessions`

Status:

Implemented and tested, pending final acceptance/merge as applicable.

---

## V2.3 — Session History & Recovery

Purpose:

Make workout state durable and inspectable.

Includes:

- session-oriented history,
- workout details,
- reload recovery,
- active-workout resume,
- historical corrections,
- backup/restore refinement,
- legacy-data handling.

---

## V2.4 — Guided Workout Interface

Purpose:

Provide a usable UI over the trainer-oriented workout state.

Includes:

- start workout,
- standard/short selection,
- current exercise,
- previous performance,
- set logging,
- skip,
- substitute,
- reorder,
- finish workout.

The interface should remain intentionally lightweight.

---

## V2.5 — Trainer State / Progression Support

Purpose:

Expose reliable performance context for coaching decisions.

Includes:

- recent performance,
- workout-state summaries,
- historical comparisons,
- explainable deterministic support where appropriate.

This milestone should avoid creating a second autonomous trainer inside GymBro.

---

## V2.6 — iPhone Hardening

Purpose:

Make GymBro reliable during real workouts.

Testing includes:

- Safari,
- lock/unlock,
- browser backgrounding,
- refresh,
- touch interaction,
- viewport behavior,
- accidental navigation,
- session recovery.

Physical iPhone testing is required.

---

## V2.7 — Production Delivery

Purpose:

Finalize automated testing and production deployment.

Includes:

- CI,
- GitHub workflow,
- Vercel deployment,
- release acceptance.

---

# 27. Historical VERSION 3 concept — Frictionless Virtual Trainer

**Future/optional integration concept — not currently scheduled.** The following describes the original concept, not active implementation work or the abandoned PR #9 infrastructure as a release.

## 27.1 Objective

Version 3 delivers the actual end-state product experience.

The goal is:

> Allow the user to perform a complete coached workout through natural conversation, preferably voice, while GymBro automatically handles structured logging and history.

V3 should feel like talking to a knowledgeable training partner.

---

# 28. V3 Architecture

V3 does not create a second workout engine.

The conversational layer interprets user language and calls the V2 action layer.

Conceptually:

`User Voice / Text`

↓

`ChatGPT Virtual Trainer`

↓

`GymBro Structured Actions`

↓

`Workout State + Persistent Data`

↓

`GymBro Dashboard / History`

The virtual trainer reasons.

GymBro records.

---

# 29. Natural Workout Conversation

The trainer should understand interactions such as:

> “I’m at the gym. Let’s get some.”

> “Only have 30 minutes.”

> “What’s first?”

> “12 clean, seven out of ten.”

> “Got 10 with two left.”

> “Same weight.”

> “Add ten.”

> “My shoulder twinged.”

> “The machine is busy.”

> “Skip it.”

> “What did I do last time?”

> “What’s next?”

> “I’m done.”

The user should not need to manually specify fields when conversational context makes the meaning clear.

---

# 30. Voice-First Operation

The intended environment includes:

- iPhone,
- earbuds,
- music,
- active exercise,
- limited desire to handle the phone.

The user should eventually be able to complete most workouts without touching the GymBro UI.

Routine interaction should be voice-first.

The visual app remains available as a dashboard and fallback.

---

# 31. Contextual Interpretation

The trainer must understand short utterances based on active workout context.

Example:

> “12.”

May mean:

12 repetitions for the current set.

> “Seven out of ten.”

May mean:

RPE 7 for the most recently reported set.

> “Same weight.”

May mean:

Keep the previous load for the next set.

> “Machine’s busy.”

May trigger:

- temporary reordering,
- or a substitute movement.

Context must come from structured GymBro workout state, not guesswork alone.

---

# 32. Automatic Logging

A primary V3 requirement is automatic structured logging.

For example:

**Trainer:**  
“Seated row. Last time you got 100 for 12. Start there.”

**User:**  
“12 clean, seven out of ten.”

GymBro should record:

- active exercise,
- 100 lb,
- 12 reps,
- RPE 7,
- correct session,
- correct set order.

The user should not need to open a logging screen.

---

# 33. Adaptive Coaching

The trainer should dynamically modify workouts based on real conditions.

## Time

> “I only have 20 minutes.”

The trainer reprioritizes the remaining workout.

## Equipment

> “Someone is still on the row machine.”

The trainer reorders the session or offers a substitute.

## Pain

> “That bothered my shoulder.”

The trainer records the issue and changes the movement when appropriate.

## Performance

The trainer may adjust subsequent load or reps based on how the user actually performed.

---

# 34. Program Evolution

The virtual trainer should be able to evolve the training plan over time.

Changes may result from:

- demonstrated strength gains,
- stalled progress,
- recurring discomfort,
- new goals,
- changing schedule,
- travel,
- exercise preference,
- available equipment,
- or the need for more/less volume.

GymBro stores the updated program and preserves prior-session history.

This reproduces the successful human/ChatGPT workflow used during the original learning phase.

---

# 35. Historical Questions and Insight

The user should eventually be able to ask:

> “What did I bench last week?”

> “Am I getting stronger on rows?”

> “What’s my best leg press set?”

> “How many workouts did I do this month?”

> “How has my weight changed?”

> “What exercises have been bothering my shoulder?”

The answers should come from structured GymBro data.

The dashboard may provide visual summaries of the same information.

---

# 36. Confirmation Strategy

Routine reversible commands should require minimal confirmation.

Example:

> “12 reps.”

→ Record the result.

Ambiguous or destructive commands may require clarification.

Example:

> “Delete that.”

The trainer may need to distinguish between:

- the last set,
- current exercise,
- or entire workout.

The goal is low friction without sacrificing data integrity.

---

# 37. AI and Data Boundaries

The persistent GymBro database is authoritative for workout facts.

The AI trainer must not silently invent:

- workout history,
- loads,
- repetitions,
- sessions,
- bodyweight,
- or completed exercises.

The AI may reason, coach, recommend, and interpret language.

Structured actions commit actual workout data.

---

# 38. Dashboard Role

The GymBro dashboard should focus on information that improves understanding of training.

Useful dashboard areas may include:

- current workout program,
- recent sessions,
- exercise history,
- progression,
- bodyweight trend,
- pain/discomfort patterns,
- personal bests where useful,
- and workout consistency.

The dashboard is for review and insight.

It should not become the primary set-by-set interaction mechanism once V3 exists.

---

# 39. Versioning

**Historical wording below:** for V3, [VERSION_POLICY.md](VERSION_POLICY.md) supersedes this section's generation/minor/build descriptions. V3 is the persistent-data/core-product-maturity generation; MINOR is an accepted release increment, and BUILD is a required committed UTC timestamp for each deployable code build. Issue #43 maps the first planned `3.1.0-BUILD` to #38 infrastructure foundation alone. Capability labels and historical milestones do not assign application versions. Documentation-only changes do not bump the app.

GymBro uses:

**MAJOR.MINOR.PATCH-BUILD**

Example:

`2.3.0-20261023T201500Z`

## Major

Major product generations:

- `1.x` — Dashboard / workout tracker
- `2.x` — Trainer infrastructure
- `3.x` — Frictionless virtual trainer

## Minor

Incremented for planned milestones within a major release.

## Patch

Used for minor fixes and nonfunctional changes.

## Build

Every produced build receives a unique identifier.

A UTC timestamp may be used.

Product version and data/schema version are separate concepts.

The application should display the full product version in the UI.

---

# 40. Non-Functional Requirements

GymBro should:

- load quickly,
- remain responsive on iPhone,
- minimize interaction during workouts,
- avoid data loss,
- persist a set before confirming success,
- survive normal browser lifecycle behavior,
- retain compatibility with historical data,
- remain manually usable if AI/voice is unavailable,
- support straightforward backup/restore,
- keep business logic independent of DOM structure,
- and expose structured actions suitable for conversational control.

---

# 41. Data Integrity Requirements

Workout history must not be casually rewritten.

GymBro must:

- preserve legacy records,
- preserve session IDs,
- maintain set/session relationships,
- preserve exercise order,
- preserve actual substitutions,
- migrate schemas explicitly,
- avoid destructive import behavior,
- prevent accidental duplicate sessions,
- recover active workouts safely,
- and distinguish known facts from inferred information.

Historical truth is more important than cosmetic consistency.

---

# 42. Product Success Criteria

GymBro succeeds when the user can walk into the gym without:

- planning the session manually,
- remembering previous numbers,
- opening a spreadsheet,
- navigating through several screens,
- or manually recording every field.

The mature experience is:

1. Open live ChatGPT voice.
2. Say, “I’m at the gym. Let’s get some.”
3. Receive the correct workout.
4. Train.
5. Verbally report results.
6. Let the trainer adapt the workout.
7. Leave the gym with the entire session already recorded.

GymBro should then make it easy to see what happened and how training is progressing.

---

# 43. Release Definitions

## GymBro V1

Complete when GymBro serves as a reliable mobile dashboard and structured log for coached workouts.

## GymBro V2

Complete when GymBro provides the durable sessions, workout state, action API, history, recovery, and trainer-relevant data needed for reliable conversational control.

## GymBro V3

Complete when ChatGPT can act as the primary virtual trainer through live conversation or voice and automatically operate GymBro during a real workout with minimal manual interaction.

---

# 44. Strategic Architecture Summary

The evolution of GymBro is:

## V1 — Capture

`Trainer + User → GymBro Dashboard → Workout Data`

## V2 — Structure

`Trainer / UI → GymBro Actions → Workout State → Persistent Data`

## V3 — Disappear Into the Background

`User Voice → ChatGPT Virtual Trainer → GymBro Actions → Structured Data → Dashboard`

V1 proves that the workout/coaching workflow works.

V2 gives that workflow reliable structured memory and controls.

V3 removes nearly all remaining friction.

The end product is not the dashboard.

**The end product is the trainer experience.**
