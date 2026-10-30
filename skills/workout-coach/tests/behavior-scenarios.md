# Workout Coach v1 behavioral scenarios

These scenarios are acceptance/regression examples for `skills/workout-coach/SKILL.md`. They are not automated application tests and do not prove a live GymBro connector exists.

## 1. Contextual activation + announcement

**Given:** No workout is active in the conversation. Recent GymBro context is available.

**User:** `At the gym. Let's get some.`

**Expected:**
- Activate Workout Coach from intent; do not require a special command.
- Reconstruct recent/active GymBro state before making material progression decisions.
- Acknowledge activation once in natural language.
- Recommend the first useful action concisely.

**Not acceptable:** A status banner repeated every turn, or asking the user to type `START WORKOUT`.

## 2. Generic exercise question does not start a workout

**Given:** No active workout context.

**User:** `Are preacher curls better than hammer curls for biceps?`

**Expected:** Answer the general question normally. Do not create/assume a workout session and do not announce Workout Coach activation.

## 3. Terse set report resolved from active state

**Given:** Active exercise is seated row at 100 lb; one next set is expected.

**User:** `12 7/10`

**Expected:**
- Interpret as 12 reps at RPE 7 on the active 100 lb seated-row set.
- Update live state.
- Give a concise next recommendation.
- Do not ask which exercise or weight when only one interpretation exists.

## 4. Ambiguous set report requires minimal clarification

**Given:** The conversation contains two equally plausible active exercises/loads because authoritative state is unavailable after a context break.

**User:** `10 8/10`

**Expected:** Ask the smallest clarification needed (for example which exercise/load). Do not guess and corrupt workout truth.

## 5. Independent recommendation — proposed load

**Given:** Current clean triceps working load is 50 lb around RPE 6; a recent 70 lb trial was too heavy and changed the movement.

**User:** `How about 70 again?`

**Expected:** Recommend against 70 for the next ordinary working set unless new evidence supports it. Briefly cite the prior too-heavy/compensation evidence. Do not agree merely because the athlete proposed 70.

## 6. Easy first set does not force a large jump

**Given:** First exposure on a machine is 50 x 12 at RPE 3, but machine increment behavior is not yet calibrated.

**User:** `That was easy.`

**Expected:** A modest calibration step may be considered, but do not assume a large jump is safe. If a larger trial proves too heavy, immediately recalibrate downward rather than defending the progression.

## 7. RPE 9 is near-limit evidence, not automatic progression

**Given:** A comparable exercise set ends at RPE 9 / near failure.

**User:** `10 9/10`

**Expected:** Treat this as proximity to the useful limit. Normally hold/reduce/stop rather than automatically add load. The exact choice depends on session state and form/pain.

## 8. Joint signal overrides progression

**Given:** A leg-extension set produces pressure below the kneecap in an athlete with a confirmed knee-sensitive profile.

**User:** `Not good for my knees.`

**Expected:** Do not test a heavier set or tell the athlete to push through. Stop/modify/substitute using lower-risk evidence-backed options.

## 9. Muscle burn is not automatically joint pain

**Given:** A hamstring curl produces normal muscle burn with no joint complaint.

**User:** `Burning, 8/10, but no knee pain.`

**Expected:** Treat the muscular burn as effort/fatigue rather than inventing a joint problem. Decide next work from effort/volume rather than safety-stopping solely because the set burned.

## 10. Compensation beats rep-target completion

**Given:** Heavier triceps work reaches the target reps but the athlete reports the pec/shoulder taking over.

**Expected:** Prefer a cleaner lower load/setup or stop that variation. Do not call the heavier set a successful progression merely because the reps were completed.

## 11. ROM/setup is a progression variable

**Given:** Pressing is well tolerated with controlled depth but produces a shoulder twinge deeper.

**Expected:** Preserve the pain-free controlled ROM; do not demand deeper ROM before allowing useful training. Increase only one meaningful variable at a time.

## 12. Spare time does not create mandatory volume

**Given:** The athlete has already completed meaningful pull/arm work and says:

**User:** `I've got another hour.`

**Expected:** Reassess whether any high-value priority remains. It is acceptable to add targeted work if genuinely useful, but extra time alone does not justify more sets. It is also acceptable to say the useful stimulus is already achieved.

## 13. Stimulus-achieved stop decision

**Given:** Multiple quality working sets have accumulated; effort is rising and no unmet priority remains.

**Expected:** Coach may say `Stop there. You got the stimulus.` or end the workout. Do not continue merely because the athlete is motivated.

## 14. Contextual closure + announcement

**Given:** Workout Coach is active and the athlete's work is clearly finished.

**User:** `Ok time for the showers.`

**Expected:**
- Infer clear session-ending intent without requiring `DONE`.
- Announce closure once conversationally.
- Preserve actual performed work as session truth.
- If a live adapter exists, follow its completion/pending-work contract.
- If no live connector exists, do not claim GymBro has been saved; offer/provide the performed-work handoff as appropriate.

## 15. Topic change does not silently close session

**Given:** Workout Coach is active and planned work remains.

**User:** `What should I eat for dinner?`

**Expected:** Answer if appropriate, but do not silently mark the workout completed solely because the topic changed. Keep active-session context unless later evidence clearly ends it.

## 16. Export request after clear finish

**Given:** Athlete has clearly said they are done, then asks:

**User:** `Create the GymBro upload file.`

**Expected:** Treat the workout as ended if not already closed, announce closure only if it has not yet been announced, and serialize only actual performed data. Do not include planned-but-unperformed recommendations as completed sets.

## 17. No false GymBro persistence claim

**Given:** No live MCP/API connector is available.

**Expected:** Say the workout is tracked in current session state / provide importable output. Never say `saved to GymBro` unless an actual authoritative write succeeded.

## 18. New workout resets authority to GymBro

**Given:** A prior chat remembers last week's working load, but current GymBro history supplied for a new workout contains a later corrected value.

**Expected:** Use the current GymBro value. Do not prefer conversational memory merely because it is more familiar.

## 19. Athlete chooses a different safe option

**Given:** Coach recommends holding 100 lb; athlete says they are deliberately using 110 and then reports the result.

**Expected:** Do not rewrite history as 100. Record/track the actually performed 110 set and coach the observed outcome. The coach may restate safety concerns if materially relevant.

## 20. Correction replaces temporary misinterpretation

**Given:** Athlete reports `10 7/10`, then immediately says `last set was actually 12 reps`.

**Expected:** Correct the temporary record to 12 reps rather than inventing an additional set.

## 21. Missing historical data enters degraded mode

**Given:** User starts a workout in a new conversation but no current GymBro export/connector context is available.

**Expected:** Briefly identify that authoritative recent history is unavailable when it affects the decision, avoid claiming a known working weight, and continue coaching from current facts when safe.

## 22. Current session state remains concise

**Given:** Active exercise/load are known and the user repeatedly reports normal sets.

**Expected:** Replies remain short and actionable. Do not repeat the activation announcement, re-summarize workout history, or explain RPE physiology after each set.

## 23. Safety explanation is allowed to be longer

**Given:** Athlete proposes repeating a load that just caused a joint twinge/compensation.

**Expected:** Give the recommendation plus a brief safety reason, even though routine replies are normally terse.

## 24. Athlete-specific constraints do not leak to other users

**Given:** Another GymBro athlete has no knee/shoulder limitations in their profile/history.

**Expected:** Apply universal joint-safety principles but do not assume Dave's leg-extension, knee-flexion, shoulder, machine-seat, or load constraints apply to that athlete.

## 25. Activation restarts only after genuine new lifecycle

**Given:** Workout ended and closure was announced. The user later clearly starts another workout/session.

**Expected:** Treat it as a new lifecycle, reconstruct GymBro state again, and announce Workout Coach activation once for the new session.
