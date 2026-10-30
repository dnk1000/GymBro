# GymBro PRD addendum — Workout Coach and trainer integration direction

**Status:** Approved product decision addendum  
**Date:** October 29, 2026  
**Applies to:** `GymBro_PRD.md`, current architecture, trainer-evidence/guided-workout boundaries, and future trainer-integration work

## Authority and supersession

This addendum records the approved Workout Coach product direction established after the October 27 V3.x scope decision.

It **does not change V3.x into the AI-integration generation** and does not make external AI/provider runtime integration a V3 completion requirement.

It does supersede the narrower statement in `GymBro_PRD.md` that external AI/provider work is simply “future/optional integration concept — not currently scheduled” to the following extent:

- a repository-managed **Workout Coach skill** is now approved design/product work;
- **Workout Coach onboarding** is approved and tracked by GitHub issue #60;
- a future **GymBro MCP/API connector plus skill update** is approved backlog work and tracked by GitHub issue #61;
- the MCP/runtime implementation remains gated behind sufficiently stable GymBro database/domain contracts and is not a V3.x core-completion blocker;
- voice remains separately scoped unless explicitly approved later.

All other V3.x core-product sequencing, migration gates, production authority and acceptance requirements remain unchanged unless another approved product decision changes them.

## Product roles

### GymBro

GymBro is the authoritative system of record and durable memory layer. It owns:

- workout templates/program structure;
- workout sessions and plan snapshots;
- performed sets and corrections;
- canonical exercise identity;
- bodyweight and workout-related observations within approved scope;
- pain/discomfort/setup notes and other persisted trainer-relevant context;
- athlete/coaching profile data when introduced;
- validated workout actions and their persistence, concurrency and retry semantics;
- historical truth and provenance.

### ChatGPT + Workout Coach skill

ChatGPT operating under the Workout Coach skill is the coaching/reasoning layer. It owns:

- interpreting conversational workout intent;
- reconstructing recent training state from GymBro evidence;
- deciding the appropriate workout or adapting the planned workout;
- recommending exercises, loads, reps and when to stop;
- progression judgment;
- joint-safety judgment within non-medical coaching scope;
- interpreting terse set reports in active-session context;
- maintaining temporary conversational/live-session context;
- explaining consequential recommendations when useful or requested.

The coach does not own a parallel persistent workout database.

## Authoritative-performance rule

**Actual performance is authoritative.**

A coaching recommendation is not a workout fact. GymBro should persist what the user actually performs, not what the coach suggested would happen.

Recommendations may be transient coaching state or optionally auditable metadata in a separately approved future design, but they must never masquerade as completed sets or overwrite observed performance.

## Contextual workout lifecycle

The Workout Coach must not depend on fixed magic phrases to begin or end coaching.

### Contextual activation

The skill should activate when workout-coaching intent is evident from natural conversation and available state. Strong signals include being at the gym/ready to train, asking what to do next, reporting a set, discussing load/progression/substitution/pain during an active workout, or resuming an active GymBro session.

Once an active workout exists, that state becomes the strongest interpretation context for terse inputs. If a short report has only one materially plausible exercise/set interpretation, the coach should use the active state rather than repeatedly ask the user to restate the exercise.

General workout discussion outside an active session does not by itself create a session.

### Contextual closure

The coach should infer session-ending intent from clear natural context: for example being done for the night, heading to the showers/leaving the gym, requesting the completed GymBro upload/export, or otherwise clearly transitioning out of the live workout.

These are examples, not hard-coded trigger strings.

If closure is ambiguous, keep the session active rather than silently complete it. If GymBro’s authoritative action contract requires confirmation before finishing with pending work, preserve that contract. “Explicit” intent means unambiguous user intent; it does not require one exact phrase.

## Interim operation before MCP

The Workout Coach skill must be useful before a live GymBro connector exists.

Approved interim flow:

**GymBro export/current context → ChatGPT + Workout Coach → temporary live-session state → GymBro-compatible performed-workout output/import**

During this period:

- supplied/imported GymBro state is the authoritative starting point;
- ChatGPT may maintain ephemeral state during the live workout;
- performed workout facts are returned in GymBro-compatible structured form;
- recommendations are not persisted as performance;
- the next workout should reconstruct state from GymBro again;
- insufficient/currently unavailable GymBro history causes a degraded-data mode, not fabricated historical certainty.

The manual interchange is a temporary transport, not an alternate system of record.

## Future connector direction

A future GymBro MCP/API connector should replace only the transport layer. The Workout Coach policy should remain substantially the same.

The preferred integration is a narrow domain-action surface rather than raw database access. It should expose validated operations for training state, active sessions, trainer evidence, performed-set logging, observations, substitutions/reordering, session completion, and coaching-profile state as those contracts mature.

The connector must preserve:

- authenticated ownership and RLS;
- canonical GymBro identities;
- validation and historical truth;
- request idempotency and duplicate protection;
- revision/concurrency behavior;
- note/data scope;
- GymBro as the sole durable workout authority.

See `WORKOUT_COACH_ARCHITECTURE.md` and issue #61.

## Onboarding direction

Workout Coach onboarding is a distinct procedure from daily coaching.

A new user may be interviewed adaptively. A user with imported/history data should receive **history-assisted onboarding**: inspect evidence first, pre-populate strongly supported facts, distinguish user-confirmed facts from observations/inferences, and ask only the unresolved questions that materially affect coaching or safety.

Starting a new chat should not force re-onboarding when GymBro already owns a usable confirmed profile.

See issue #60.

## V3 relationship

The approved generation boundary remains:

> **Make the data trustworthy → make the core product complete → expose it to AI later.**

The Workout Coach skill can be authored and exercised now using the interim adapter because it does not require GymBro runtime AI integration. Onboarding/profile design may proceed as separately scoped work.

The live MCP/API connector should wait until the relevant GymBro system-of-record, identity, session, ownership and concurrency contracts are stable enough to expose safely.

Neither #60 nor #61 is automatically part of V3.x release acceptance unless a later product decision explicitly moves it into that scope.

## Non-goals established by this decision

This decision does not authorize:

- raw ChatGPT/LLM access to GymBro database tables;
- an autonomous second coaching engine inside GymBro;
- provider-owned workout history;
- persistence of suggested sets as if performed;
- medical diagnosis;
- voice runtime implementation;
- bypassing V3 migration/production acceptance gates;
- rigid start/finish command words.
