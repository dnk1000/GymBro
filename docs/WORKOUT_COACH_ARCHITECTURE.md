# GymBro Workout Coach architecture

Status: approved design direction, October 29, 2026. This document defines the boundary between GymBro, the Workout Coach skill, ChatGPT, and future connector transports. It does not by itself authorize application runtime changes beyond the GitHub issues that reference it.

## Product boundary

GymBro is the authoritative system of record for durable workout facts and persistent coaching context. ChatGPT, operating under the Workout Coach skill, is the coaching and reasoning layer.

The intended flow is:

**User voice/text → ChatGPT + Workout Coach skill → GymBro data/actions → authoritative workout history → future coaching context**

The coach may reason from GymBro data, maintain temporary live-session context, and recommend actions. It must not establish a parallel workout database or treat its own recommendations as performed workout facts.

### Authority rules

1. **Performance is authoritative.** What the user actually performs is the workout fact. Recommendations are not workout facts.
2. **GymBro wins at session boundaries.** When a new workout begins, authoritative GymBro state supersedes remembered conversational workout state.
3. **Conversation state is temporary.** Live coaching may maintain active exercise, set count, current load, recent feedback and next intended coaching action, but this state is not durable authority until accepted GymBro actions persist the underlying workout facts.
4. **Do not guess material facts.** Unknown loads, reps, RPE/RIR, pain, substitutions, setup details or exercise identity remain unknown unless they can be resolved unambiguously from active session state.
5. **User retains final control.** The coach may independently alter or challenge the proposed workout based on evidence, recovery and joint-safety constraints, but the user remains the decision maker.

## Skill activation: contextual, not phrase-based

The Workout Coach skill should activate from conversational intent and available workout state rather than require a fixed command.

High-confidence activation signals include:

- the user indicates they are at the gym or ready to train;
- the user asks what workout/exercise/set to do next;
- the user reports a set in shorthand such as `12 7/10` or `10, two in reserve` while workout context exists;
- the user asks about a load, progression, substitution, exercise order, form, pain or equipment during a workout;
- GymBro reports an active session and the conversation continues with workout-relevant input;
- the user resumes a previously active workout.

A phrase such as “I’m at the gym. Let’s get some.” is a strong example, not a required trigger.

### Activation announcement

When the coach first determines with high confidence that Workout Coach has activated for a workout, it must make that state visible to the user with a short, natural acknowledgement woven into the coaching response.

This is a lifecycle acknowledgement, not a required banner, exact sentence, command response, or repeated status label. It should sound appropriate to the conversation—for example, acknowledging that the coach is on, that the workout is underway, or immediately framing the first coaching action. The acknowledgement should occur once at activation or resume, not before every set.

The announcement must not falsely imply that GymBro persistence or a live connector is available. In interim/degraded mode, wording should reflect the actual data/transport state when that distinction matters.

### Activation precedence

Once an active workout context is established, that state becomes the strongest interpretation signal. Terse inputs should be interpreted against the active exercise/set when only one plausible interpretation exists.

Example: with an active seated-row set at 100 lb, `12 7/10` should normally be interpreted as 12 reps at RPE 7 for that active set without asking which exercise the user means.

If more than one materially plausible interpretation exists, do not fabricate certainty. Ask only the smallest clarification needed to protect workout truth or safety.

Workout-adjacent discussion outside an active session does not automatically create a workout. For example, post-workout nutrition discussion or a general exercise question should not silently start a session merely because it mentions training.

## Session closure: contextual, not phrase-based

The coach should infer that the workout is ending from unambiguous conversational context rather than require a fixed word such as `done`.

High-confidence closure signals include:

- “done,” “that’s it,” “done for tonight,” or equivalent natural language;
- “time for the showers,” leaving the gym, or another clear transition out of training;
- a request to create/export/upload the completed GymBro workout record;
- an explicit transition to post-workout review after the session’s work is clearly finished;
- future GymBro state indicating the active session has already been completed.

The examples above are evidence of intent, not hard-coded trigger phrases.

### Closure announcement

When the coach determines with high confidence that the workout/coaching session has ended, it must explicitly acknowledge that closure conversationally so the user knows Workout Coach is no longer treating subsequent shorthand as part of the active workout.

The acknowledgement should be brief and fit the moment—for example, confirming that the workout is wrapped, summarizing the final state when useful, or naturally transitioning to post-workout discussion. It is not a fixed phrase or UI banner.

Do not announce closure merely because the topic changes temporarily, the user pauses, or the conversation becomes ambiguous. Announce closure only when the same contextual standard used to end the session is satisfied. If GymBro persistence is available, do not claim the session is saved/completed until the authoritative completion action succeeds; distinguish conversational workout closure from persistence failure when necessary.

### Closure confidence and unfinished work

If closure is ambiguous, the coach should keep the session active rather than silently complete it.

If closure intent is unambiguous but planned work remains, the coach should reconcile that intent with GymBro’s authoritative session-completion contract. The current guided-workout action layer may require confirmation before completing a session with pending slots. “Explicit confirmation” means unambiguous user intent, not an exact magic phrase. If the current user statement clearly means the workout is over, it may satisfy the conversational requirement to end; if the user merely changes topic or pauses, it does not.

The coach should not manufacture completed/skipped exercise statuses simply to make a finished session look tidy. Performed sets remain authoritative and pending/skipped/completed states must follow GymBro action rules.

## Live-session state maintained by the coach

During an active workout, the coach should maintain enough temporary state to interpret shorthand safely and make the next recommendation:

- active session identity when available;
- active exercise / plan slot;
- current load and unit when established;
- completed sets for the active exercise;
- latest reps and RPE/RIR;
- pain, compensation or unusual joint-pressure feedback;
- relevant equipment/setup detail;
- recent substitutions and exercise-order changes;
- cumulative session exposure relevant to the next decision;
- the next intended coaching action.

This state should be reconstructed from GymBro wherever possible and updated from the current conversation as new performance occurs.

## Coaching data adapter

The skill must depend on a provider-neutral logical GymBro data/action interface rather than a specific transport such as MCP.

Representative capabilities:

- read athlete/coaching profile;
- read active workout/session state;
- read recent sessions and exercise history;
- read trainer evidence / last comparable performance;
- read learned exercise/setup state;
- start or resume a workout;
- select/reorder/substitute/skip workout items through validated GymBro actions;
- record an actually completed set;
- record pain/discomfort/setup observations in the appropriate scope;
- complete a workout through the validated GymBro session action;
- update confirmed athlete profile or learned exercise state where the product contract allows it.

The exact function names may evolve. The policy boundary should not.

## Interim operation before MCP

Until ChatGPT has a live GymBro connector, the Workout Coach runs in an interim adapter mode:

**GymBro export/context → ChatGPT Workout Coach → live conversation state → GymBro-compatible performed-workout output/import**

Rules for the interim adapter:

- imported/provided GymBro data is the authoritative starting state;
- ChatGPT may maintain ephemeral session state during the workout;
- actual user performance is serialized back to GymBro-compatible structured data;
- recommendations are not written as performed sets;
- the next workout should reconstruct state from GymBro again rather than rely on stale conversational memory;
- when recent GymBro state is unavailable, the coach must identify degraded-data mode rather than present uncertain historical loads or progression as authoritative.

Manual import/export is therefore a temporary transport, not a separate architecture.

## Future MCP connector boundary

A future GymBro MCP/API connector should implement the same logical adapter without changing coaching policy.

The preferred connector surface is domain-oriented and narrow. ChatGPT should receive validated workout/profile operations rather than raw database-table access.

Representative future operations may include:

- `get_training_state`
- `get_active_session`
- `get_exercise_history`
- `start_or_resume_session`
- `log_set`
- `record_observation`
- `substitute_exercise`
- `update_session_plan`
- `complete_session`
- `get_or_update_coaching_profile`

Names are illustrative until the MCP contract is specified.

The connector must preserve GymBro’s canonical identities, ownership/RLS rules, validation, retry/idempotency behavior, revision/concurrency rules, and session truth. It must not expose or create a second exercise taxonomy or provider-owned workout store.

## Degraded-data mode

If the skill activates without access to sufficiently current GymBro state:

- coach from facts available in the current conversation;
- distinguish current-session facts from historical assumptions;
- do not claim a historical working weight, prior RPE, recent volume or progression decision is authoritative unless supported by available GymBro data;
- ask only when the missing fact materially affects safety or the next coaching decision;
- continue useful coaching when safe rather than blocking on perfect history.

## Onboarding relationship

Workout Coach onboarding and daily coaching are separate procedures sharing the same data boundary.

Onboarding creates or confirms persistent athlete/coaching context such as goals, schedule, limitations, coaching preferences and learned exercise state. History-assisted onboarding should inspect existing GymBro data before asking questions.

Daily coaching consumes that profile plus authoritative recent workout state. It should not re-run onboarding simply because a new chat starts.

See GitHub issue #60 for the onboarding implementation specification.

## Future connector relationship

The initial Workout Coach skill should function through the interim adapter. A future MCP connector should replace the transport only, then the skill should be updated to prefer live GymBro reads/writes while retaining the same coaching policy and degraded-data fallback.

This work is intentionally separate from V3 core-product completion. V3’s database, identity, concurrency and session contracts should mature first so that the connector exposes stable domain truth rather than leaking an unstable persistence model.

## Non-goals

This architecture does not authorize:

- raw LLM access to GymBro database tables;
- provider-owned workout persistence;
- storing recommendations as completed performance;
- automatic medical diagnosis;
- silent creation of historical facts;
- rigid phrase-based workout start/finish commands;
- a second autonomous coaching engine inside GymBro competing with ChatGPT.
