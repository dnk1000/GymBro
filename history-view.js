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
      };
    })
    .filter((group) => source === "all" || group.sets.length > 0);
  const legacyByDate = new Map();
  for (const set of snapshot.sets) {
    if (set.sessionId != null || !matches(set)) continue;
    if (!legacyByDate.has(set.date)) legacyByDate.set(set.date, []);
    legacyByDate.get(set.date).push(set);
  }
  for (const [date, sets] of legacyByDate) {
    groups.push({ kind: "legacy", date, sets, totalSetCount: sets.length });
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
