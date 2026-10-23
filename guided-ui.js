// Thin DOM adapter. All committed guided state and behavior live in actions.
let guidedFormContext = null;
let guidedActionUntil = 0;
function hasUnsavedSetInput() {
  return (
    !!editingSetId ||
    [fWeight, fReps, fRpe, fRir, fPainArea, fNotes].some((el) =>
      el.value.trim(),
    ) ||
    Number(fPain.value) > 0 ||
    document.getElementById("fApproximate").checked
  );
}
function confirmDiscardSetInput() {
  return (
    !hasUnsavedSetInput() ||
    confirm(
      "Discard the unsaved set form values? Logged sets are already saved.",
    )
  );
}
function setGuidedFormContext(state, requestId = newId(), committed = false) {
  guidedFormContext = {
    sessionId: state.sessionId,
    planSlotId: state.currentSlotId,
    revision: state.revision,
    requestId,
    committed,
  };
  fWeight.placeholder = "Enter load";
  fDate.value = state.session.date;
  fDate.readOnly = true;
  fExercise.value = state.currentExercise.actualExercise;
  fExercise.readOnly = true;
  document.getElementById("guidedFormNotice").hidden = false;
  document.getElementById("guidedEntryActions").hidden = false;
  document.getElementById("guidedEntryNext").disabled = !state.nextExercise;
  document.getElementById("guidedFormMessage").textContent =
    `Logging for ${state.session.planSnapshot.name}: ${state.currentExercise.actualExercise}.`;
  document.getElementById("setFormTitle").textContent = "Log guided set";
  document.getElementById("saveSetBtn").textContent = "Log guided set";
}
function useManualLogging() {
  if (!confirmDiscardSetInput()) return;
  clearForm();
}
function logCurrentExercise() {
  if (!confirmDiscardSetInput()) return;
  const state = workoutActions.getGuidedWorkoutState();
  if (!state || state.session.status !== "active") return;
  clearForm();
  setGuidedFormContext(state);
  document.getElementById("setFormTitle").scrollIntoView({ block: "start" });
  fWeight.focus({ preventScroll: true });
}
function startGuidedWorkout() {
  if (workoutActions.getActiveSession()) return;
  if (!confirmDiscardSetInput()) return;
  const result = workoutActions.startGuidedSession({
    date: document.getElementById("guidedDate").value,
    templateId: document.getElementById("guidedTemplate").value,
    duration: Number(document.getElementById("guidedDuration").value),
  });
  if (applyActionResult(result)) {
    clearForm();
    setGuidedFormContext(workoutActions.getGuidedWorkoutState());
  }
}
function enableGuidedWorkout() {
  if (!confirmDiscardSetInput()) return;
  const session = workoutActions.getActiveSession();
  if (session && applyActionResult(workoutActions.enableGuidance(session.id))) {
    clearForm();
    setGuidedFormContext(workoutActions.getGuidedWorkoutState());
  }
}
function guidedCommand(command, value) {
  if (Date.now() < guidedActionUntil) return;
  if (!confirmDiscardSetInput()) return;
  const state = workoutActions.getGuidedWorkoutState();
  if (!state) return;
  const input = {
    sessionId: state.sessionId,
    planSlotId: state.currentSlotId,
    expectedRevision: state.revision,
  };
  let result;
  if (command === "move")
    result = workoutActions.moveGuidedSlot({ ...input, direction: value });
  if (command === "select")
    result = workoutActions.selectGuidedSlot({ ...input, planSlotId: value });
  if (command === "status")
    result = workoutActions.setGuidedSlotStatus({ ...input, status: value });
  if (command === "substitute")
    result = workoutActions.substituteGuidedExercise({
      ...input,
      exercise: document.getElementById("guidedSubstitute").value,
    });
  if (command === "finish") {
    if (
      !confirm(
        state.remainingSlots.length
          ? `Finish with ${state.remainingSlots.length} unfinished exercises? Pending statuses will be preserved.`
          : "Finish this workout?",
      )
    )
      return;
    result = workoutActions.finishGuidedSession({
      ...input,
      allowPending: true,
    });
  }
  if (result && applyActionResult(result)) {
    guidedActionUntil = Date.now() + 450;
    clearForm();
    const current = workoutActions.getGuidedWorkoutState();
    if (current) setGuidedFormContext(current);
  }
}
function renderGuidedWorkout() {
  const root = document.getElementById("guidedWorkout"),
    active = workoutActions.getActiveSession();
  if (!active) {
    root.innerHTML = `<h2>Guided workout</h2><p class="sub">Choose a saved workout and approximate mode. No set targets or timers are prescribed. Manual logging remains available below.</p><div class="guided-choices"><label>Workout<select id="guidedTemplate">${db.program.templates.map((t) => `<option value="${esc(t.id)}" ${t.id === db.program.activeTemplateId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label><label>Mode<select id="guidedDuration"><option value="60" ${db.program.activeDuration === 60 ? "selected" : ""}>About 60 minutes</option><option value="30" ${db.program.activeDuration === 30 ? "selected" : ""}>About 30 minutes · abbreviated</option></select></label><label>Workout date<input id="guidedDate" type="date" value="${today()}"></label></div><button id="startGuidedButton" onclick="startGuidedWorkout()">Start workout</button>`;
    return;
  }
  if (!active.guided) {
    root.innerHTML = `<h2>Active workout · ${esc(active.date)}</h2><p>${esc(active.planSnapshot?.name || "Unplanned workout")} · ${active.duration}-minute mode</p><p class="sub">Manual logging is available. Enabling guidance preserves saved sets and the original plan; all exercise statuses start pending.</p>${active.planSnapshot?.slots.length ? '<button onclick="enableGuidedWorkout()">Enable guidance</button>' : '<p class="sub">This session has no planned slots and cannot be guided. Use manual logging.</p>'}<button class="btn secondary" onclick="finishManualSession()">Finish active workout</button>`;
    return;
  }
  const state = workoutActions.getGuidedWorkoutState(),
    current = state.currentExercise;
  const previous =
    state.previousPerformance
      .map(
        (group) =>
          `<div class="guided-previous"><strong>${esc(group.unit)} · ${esc(group.kind)}</strong><div>${esc(group.date)}: ${group.sets.map((set) => `${fmt(set.weight)} ${esc(set.unit)} × ${fmt(set.reps)}`).join("; ")}</div></div>`,
      )
      .join("") ||
    '<p class="sub">No previous complete, suitable records for this exercise. Nothing is recommended or prefilled.</p>';
  root.innerHTML = `<h2>${esc(active.planSnapshot.name)}</h2><p class="sub">${esc(active.date)} · ${active.duration}-minute mode · active · ${state.remainingSlots.length} pending</p><label>Current exercise<select id="guidedSlot" onchange="const selected = this.value; this.value = ${jsArg(state.currentSlotId)}; guidedCommand('select', selected)">${state.slots.map((slot, i) => `<option value="${esc(slot.planSlotId)}" ${slot.planSlotId === state.currentSlotId ? "selected" : ""}>${i + 1}. ${esc(slot.actualExercise)} · ${esc(slot.status)}</option>`).join("")}</select></label><h3>${esc(current.actualExercise)}</h3><p class="sub">Planned: ${esc(current.plannedExercise)} · ${esc(current.status)}. Navigation does not mark an exercise done.</p>${db.preferences[current.actualExercise] ? `<p>${esc(db.preferences[current.actualExercise])}</p>` : ""}<details><summary>Previous performance · informational only</summary>${previous}<p class="sub">Units are separate. These are recorded results, not targets or substitute equivalence.</p></details><p>${current.sets.length} sets recorded for this planned slot.</p><ul class="guided-sets">${current.sets.map((set) => `<li>${esc(set.exercise)}: ${fmt(set.weight)} ${esc(set.unit)} × ${fmt(set.reps)}${set.complete ? "" : " · incomplete"}</li>`).join("")}</ul><div class="guided-controls"><button onclick="logCurrentExercise()">Log current exercise</button><button class="btn secondary" onclick="guidedCommand('status','completed')">Done</button><button class="btn secondary" onclick="guidedCommand('status','skipped')">Skip</button><button class="btn secondary" ${state.previousExercise ? "" : "disabled"} onclick="guidedCommand('move','previous')">Previous</button><button class="btn secondary" ${state.nextExercise ? "" : "disabled"} onclick="guidedCommand('move','next')">Next</button></div><div class="guided-substitution"><label>Session-only substitute<select id="guidedSubstitute">${Object.keys(
    db.exerciseLibrary,
  )
    .sort()
    .map(
      (exercise) =>
        `<option ${exercise === current.actualExercise ? "selected" : ""}>${esc(exercise)}</option>`,
    )
    .join(
      "",
    )}</select></label><button class="btn secondary" onclick="guidedCommand('substitute')">Use substitute</button></div><p class="sub">Substitution changes subsequent sets only. Earlier sets and the saved plan stay unchanged.</p><button class="btn secondary" onclick="guidedCommand('finish')">Finish workout</button>`;
}
function finishManualSession() {
  if (
    !confirmDiscardSetInput() ||
    !confirm("Finish this active workout? Saved sets will be retained.")
  )
    return;
  const active = workoutActions.getActiveSession();
  if (active && applyActionResult(workoutActions.completeSession(active.id)))
    clearForm();
}
// A new intentional form entry gets a new request identity; repeated taps don't.
document.addEventListener("input", (event) => {
  if (
    guidedFormContext?.committed &&
    event.target.closest("#workout .formgrid")
  ) {
    guidedFormContext.requestId = newId();
    guidedFormContext.committed = false;
  }
});
