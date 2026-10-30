// Consecutive runs are display occurrences, never persisted exercise identity.
// Group before filtering: hiding B in A / B / A must not combine the two As.
function getHistoryExerciseGroups(sets, source = "all") {
  const runs = [];
  for (const set of sets) {
    let run = runs.at(-1);
    if (!run || run.exercise !== set.exercise) {
      run = { exercise: set.exercise, firstSetId: set.id, sets: [] };
      runs.push(run);
    }
    run.sets.push(set);
  }
  return runs
    .map((run) => ({
      ...run,
      sets: run.sets.filter((set) => source === "all" || set.source === source),
    }))
    .filter((run) => run.sets.length > 0);
}

// Detached presentation data only. Legacy date groups never become sessions.
function getHistoryGroups(data, source = "all") {
  const snapshot = JSON.parse(JSON.stringify(data));
  const byId = new Map(snapshot.sets.map((set) => [set.id, set]));
  const matches = (set) => source === "all" || set.source === source;
  const groups = snapshot.sessions
    .map((session) => {
      const allSets = session.setIds.map((id) => byId.get(id));
      return {
        kind: "session",
        date: session.date,
        session,
        totalSetCount: allSets.length,
        sets: allSets.filter(matches),
        exerciseGroups: getHistoryExerciseGroups(allSets, source),
      };
    })
    .filter((group) => source === "all" || group.sets.length > 0);
  const legacyByDate = new Map();
  for (const set of snapshot.sets) {
    if (set.sessionId != null) continue;
    if (!legacyByDate.has(set.date)) legacyByDate.set(set.date, []);
    legacyByDate.get(set.date).push(set);
  }
  for (const [date, sets] of legacyByDate) {
    const matchingSets = sets.filter(matches);
    if (!matchingSets.length) continue;
    groups.push({
      kind: "legacy", date, sets: matchingSets,
      totalSetCount: matchingSets.length,
      exerciseGroups: getHistoryExerciseGroups(sets, source),
    });
  }
  return groups.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (a.kind === b.kind
        ? (b.session?.createdAt ?? "").localeCompare(a.session?.createdAt ?? "")
        : a.kind === "session"
          ? -1
          : 1),
  );
}
