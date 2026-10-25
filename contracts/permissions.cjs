const READ = [
  "getWorkoutState",
  "getSession",
  "getActiveSession",
  "getGuidedWorkoutState",
  "getExercisePerformanceContext",
  "compareExercisePerformance",
  "getTrainerWorkoutContext",
];
const WORKOUT = [
  "createSession",
  "completeSession",
  "startGuidedSession",
  "enableGuidance",
  "selectGuidedSlot",
  "moveGuidedSlot",
  "setGuidedSlotStatus",
  "substituteGuidedExercise",
  "logGuidedSet",
  "finishGuidedSession",
  "logSet",
  "logBodyweight",
];
const HISTORY = ["editSet", "deleteSet", "attachSetToSession", "commitImport"];
const OWNER = [
  "selectPlan",
  "clearPlan",
  "toggleSlotShort",
  "cycleSlotRole",
  "removeSlot",
  "addSlot",
];
const SCOPES = ["training:read", "workout:write", "history:modify"];
const scopes = Object.freeze(
  Object.fromEntries([
    ...READ.map((x) => [x, "training:read"]),
    ...WORKOUT.map((x) => [x, "workout:write"]),
    ...HISTORY.map((x) => [x, "history:modify"]),
  ]),
);
function error(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}
function owner(auth) {
  if (auth.clientId)
    throw error(
      "FIRST_PARTY_REQUIRED",
      "Use your GymBro account for this operation.",
      403,
    );
}
function permission(auth, action, grant) {
  if (!Object.hasOwn(scopes, action) && !OWNER.includes(action))
    throw error("UNKNOWN_ACTION", "Unsupported action.");
  if (!auth.clientId) return;
  if (
    !grant ||
    grant.revoked_at ||
    auth.issuedAt < Number(grant.not_before) ||
    !grant.scopes.includes(scopes[action])
  )
    throw error(
      "FORBIDDEN",
      "This application is not authorized for this action.",
      403,
    );
}
module.exports = {
  READ,
  WORKOUT,
  HISTORY,
  OWNER,
  SCOPES,
  scopes,
  error,
  owner,
  permission,
};
