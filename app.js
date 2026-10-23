const KEY = "daveGymTrackerV1";
const {
  fDate,
  fExercise,
  fWeight,
  fUnit,
  fReps,
  fRpe,
  fRir,
  fPain,
  fPainArea,
  fNotes,
  bwDate,
  bwValue,
  exerciseList,
  weightChart,
  performanceChart,
  kpis,
  gains,
  flags,
  activePlanLabel,
  todayPlan,
  todaySets,
  historyFilter,
  historyTable,
  exerciseTable,
  exerciseDetail,
  exerciseDetailTitle,
  exerciseChart,
  inboxRaw,
  inboxStatus,
  inboxMeta,
  inboxReview,
  commitInboxBtn,
  importHistory,
  programTemplates,
  taxonomySummary,
  templateEditorTitle,
  templateEditor,
  importFile,
} = Object.fromEntries(
  [
    "fDate",
    "fExercise",
    "fWeight",
    "fUnit",
    "fReps",
    "fRpe",
    "fRir",
    "fPain",
    "fPainArea",
    "fNotes",
    "bwDate",
    "bwValue",
    "exerciseList",
    "weightChart",
    "performanceChart",
    "kpis",
    "gains",
    "flags",
    "activePlanLabel",
    "todayPlan",
    "todaySets",
    "historyFilter",
    "historyTable",
    "exerciseTable",
    "exerciseDetail",
    "exerciseDetailTitle",
    "exerciseChart",
    "inboxRaw",
    "inboxStatus",
    "inboxMeta",
    "inboxReview",
    "commitInboxBtn",
    "importHistory",
    "programTemplates",
    "taxonomySummary",
    "templateEditorTitle",
    "templateEditor",
    "importFile",
  ].map((id) => [id, document.getElementById(id)]),
);
let db = load();
let editingSetId = null;
let selectedExercise = "Seated Row";
let selectedTemplateId = null;
function jsArg(value) {
  return esc(JSON.stringify(String(value)));
}
function newId() {
  return (
    "m" +
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
          n.toString(16).padStart(2, "0"),
        ).join(""))
  );
}
function ensureExercise(data, name) {
  if (!hasOwn(data.exerciseLibrary, name))
    data.exerciseLibrary[name] = {
      primary: "Uncategorized",
      secondary: [],
      pattern: "",
      type: "",
      status: "new",
    };
}
function numeric(value) {
  return value == null || (typeof value === "string" && value.trim() === "")
    ? null
    : typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}
function fmt(v, d = 0) {
  return v == null || Number.isNaN(+v) ? "—" : (+v).toFixed(d);
}
function unique(a) {
  return [...new Set(a)];
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function setDefaultDates() {
  ["fDate", "bwDate"].forEach(
    (id) => (document.getElementById(id).value = today()),
  );
}

document.querySelectorAll(".tab").forEach(
  (t) =>
    (t.onclick = () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.remove("active"));
      document
        .querySelectorAll(".view")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      document.getElementById(t.dataset.view).classList.add("active");
      if (t.dataset.view === "exercises") renderExercises();
      if (t.dataset.view === "history") renderHistory();
      if (t.dataset.view === "program") renderProgram();
      if (t.dataset.view === "inbox") renderImportHistory();
    }),
);

function addSet() {
  const previous = editingSetId
    ? db.sets.find((s) => s.id === editingSetId)
    : null;
  const e = {
    ...previous,
    id: previous?.id || newId(),
    date: fDate.value,
    exercise: fExercise.value.trim(),
    weight: numeric(fWeight.value),
    unit: fUnit.value,
    reps: numeric(fReps.value),
    rpe: numeric(fRpe.value),
    rir: numeric(fRir.value),
    pain: numeric(fPain.value) ?? 0,
    painArea: fPainArea.value.trim(),
    notes: fNotes.value.trim(),
    source: previous?.source || "manual",
  };
  e.complete =
    e.weight != null &&
    e.reps != null &&
    !document.getElementById("fApproximate").checked;
  const errors = setErrors(e);
  if (!validDate(e.date)) errors.push("Choose a valid workout date.");
  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }
  if (
    changeDB((next) => {
      ensureExercise(next, e.exercise);
      if (previous) next.sets[next.sets.findIndex((s) => s.id === e.id)] = e;
      else next.sets.push(e);
    })
  )
    clearForm(false);
}
function clearForm(clearEx = true) {
  editingSetId = null;
  document.getElementById("fApproximate").checked = false;
  document.getElementById("setFormTitle").textContent = "Log a set";
  document.getElementById("saveSetBtn").textContent = "Add set";
  if (clearEx) fExercise.value = "";
  ["fWeight", "fReps", "fRpe", "fRir", "fPainArea", "fNotes"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  fPain.value = "0";
}
function editSet(id) {
  const s = db.sets.find((s) => s.id === id);
  if (!s) return;
  clearForm();
  editingSetId = id;
  document.getElementById("fApproximate").checked = !s.complete;
  for (const [field, key] of Object.entries({
    fDate: "date",
    fExercise: "exercise",
    fWeight: "weight",
    fUnit: "unit",
    fReps: "reps",
    fRpe: "rpe",
    fRir: "rir",
    fPain: "pain",
    fPainArea: "painArea",
    fNotes: "notes",
  }))
    document.getElementById(field).value = s[key] ?? "";
  document.getElementById("setFormTitle").textContent = "Edit set";
  document.getElementById("saveSetBtn").textContent = "Save changes";
  document.querySelector('[data-view="workout"]').click();
  renderToday();
  fExercise.focus();
}
function addBodyweight() {
  const row = {
    date: bwDate.value,
    value: numeric(bwValue.value),
    source: "manual",
  };
  if (!validDate(row.date) || !validNumber(row.value, Number.MIN_VALUE)) {
    alert("Enter a valid date and positive bodyweight.");
    return;
  }
  if (changeDB((next) => next.bodyweights.push(row))) bwValue.value = "";
}
function deleteSet(id) {
  if (confirm("Delete this set?")) {
    if (
      changeDB((next) => {
        const set = next.sets.find((s) => s.id === id);
        next.sets = next.sets.filter((s) => s.id !== id);
        if (set?.importBatch) {
          const row = next.imports.find((x) => x.batch === set.importBatch);
          if (row)
            row.setCount = next.sets.filter(
              (s) => s.importBatch === row.batch,
            ).length;
        }
      }) &&
      editingSetId === id
    )
      clearForm();
  }
}
function renderAll() {
  renderDatalist();
  renderKpis();
  renderDashboard();
  renderToday();
  renderHistory();
  renderProgram();
  renderImportHistory();
  renderExercises();
  if (selectedTemplateId) editTemplate(selectedTemplateId);
}
function allExercises() {
  return unique([
    ...db.sets.map((s) => s.exercise),
    ...Object.keys(db.exerciseLibrary || {}),
  ]).sort();
}
function renderDatalist() {
  exerciseList.innerHTML = allExercises()
    .map((x) => `<option value="${esc(x)}">`)
    .join("");
}
function sessions() {
  return unique(db.sets.map((s) => s.date)).sort();
}
function isComplete(s) {
  return (
    s.complete === true &&
    validNumber(s.weight, 0) &&
    validNumber(s.reps, 1, Infinity, true)
  );
}
function volume(s) {
  return isComplete(s) ? s.weight * s.reps : 0;
}
function performanceRows(ex) {
  const all = db.sets.filter(
    (s) =>
      s.exercise === ex &&
      isComplete(s) &&
      s.weight > 0 &&
      !["assist lb", "bodyweight"].includes(s.unit),
  );
  const latest = [...all].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return all.filter((s) => s.unit === latest?.unit);
}
function renderKpis() {
  const sess = sessions();
  const complete = db.sets.filter(isComplete);
  const latestBW = [...db.bodyweights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const html = [
    ["Training days", sess.length, "unique workout dates"],
    ["Logged sets", db.sets.length, `${complete.length} complete`],
    ["Exercises", unique(db.sets.map((s) => s.exercise)).length, "tracked"],
    [
      "Latest weight",
      latestBW ? latestBW.value.toFixed(1) + " lb" : "—",
      latestBW ? latestBW.date : "",
    ],
  ]
    .map(
      ([l, v, s]) =>
        `<div class="card"><div class="label">${l}</div><div class="kpi">${v}</div><div class="sub">${s}</div></div>`,
    )
    .join("");
  kpis.innerHTML = html;
}
function lineChart(canvas, pts, labelFn = (v) => v) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.font = "12px system-ui";
  c.fillStyle = "#9eabc7";
  if (!pts.length) {
    c.fillText("Not enough data yet", 20, 30);
    return;
  }
  const pad = { l: 48, r: 18, t: 20, b: 42 };
  const vals = pts.map((p) => p.v);
  let min = Math.min(...vals),
    max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i) =>
    pad.l +
    (w - pad.l - pad.r) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min));
  c.strokeStyle = "#2b3654";
  c.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = pad.t + ((h - pad.t - pad.b) * i) / 3;
    c.beginPath();
    c.moveTo(pad.l, yy);
    c.lineTo(w - pad.r, yy);
    c.stroke();
    const val = max - ((max - min) * i) / 3;
    c.fillText(labelFn(val), 4, yy + 4);
  }
  c.strokeStyle = "#66a6ff";
  c.lineWidth = 3;
  c.beginPath();
  pts.forEach((p, i) => {
    const xx = x(i),
      yy = y(p.v);
    i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
  });
  c.stroke();
  c.fillStyle = "#eef3ff";
  pts.forEach((p, i) => {
    const xx = x(i),
      yy = y(p.v);
    c.beginPath();
    c.arc(xx, yy, 4, 0, Math.PI * 2);
    c.fill();
    if (i === 0 || i === pts.length - 1)
      c.fillText(p.label, Math.max(3, xx - 28), h - 16);
  });
}
function bestByDate(ex) {
  const map = new Map();
  performanceRows(ex).forEach((s) => {
    const score = volume(s);
    if (!map.has(s.date) || score > map.get(s.date).score)
      map.set(s.date, { v: score, score, label: s.date.slice(5), s });
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, o]) => ({ date, ...o }));
}
function renderDashboard() {
  const bw = [...db.bodyweights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({ v: x.value, label: x.date.slice(5) }));
  lineChart(weightChart, bw, (v) => v.toFixed(0) + " lb");
  const perf = bestByDate("Seated Row").map((x) => ({
    v: x.v,
    label: x.label,
  }));
  lineChart(performanceChart, perf, (v) => Math.round(v));
  renderGains();
  renderFlags();
}
function renderGains() {
  const candidates = [
    "Seated Row",
    "Lat Pulldown",
    "Smith Press",
    "Lateral Raise",
    "Leg Press",
  ];
  const out = [];
  for (const ex of candidates) {
    const rows = performanceRows(ex).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    if (rows.length < 2) continue;
    const dates = unique(rows.map((s) => s.date));
    if (dates.length < 2) continue;
    const first = rows
      .filter((s) => s.date === dates[0])
      .sort((a, b) => volume(b) - volume(a))[0];
    const last = rows
      .filter((s) => s.date === dates.at(-1))
      .sort((a, b) => volume(b) - volume(a))[0];
    const pct = ((volume(last) - volume(first)) / volume(first)) * 100;
    out.push({ ex, pct, first, last });
  }
  out.sort((a, b) => b.pct - a.pct);
  gains.innerHTML =
    out
      .slice(0, 5)
      .map(
        (g) =>
          `<div class="item"><div class="split"><strong>${esc(g.ex)}</strong><span class="pill ${g.pct >= 0 ? "good" : "warn"}">${g.pct >= 0 ? "+" : ""}${g.pct.toFixed(0)}% set work</span></div><div class="sub">${g.first.date}: ${fmt(g.first.weight)} ${g.first.unit} × ${fmt(g.first.reps)} → ${g.last.date}: ${fmt(g.last.weight)} ${g.last.unit} × ${fmt(g.last.reps)}</div></div>`,
      )
      .join("") || '<div class="sub">More sessions needed.</div>';
}
function renderFlags() {
  const arr = [];
  const pains = db.sets.filter((s) => s.pain > 0);
  const byArea = Object.create(null);
  pains.forEach((s) => (byArea[s.painArea || "unspecified"] ??= []).push(s));
  for (const [area, rows] of Object.entries(byArea)) {
    arr.push({
      sev: Math.max(...rows.map((r) => r.pain)),
      title: `${area} pain/twinge logged`,
      text: `${rows.length} set(s). Latest: ${rows.sort((a, b) => a.date.localeCompare(b.date)).at(-1).exercise} on ${rows.at(-1).date}.`,
    });
  }
  const high = db.sets.filter((s) => s.rpe >= 9);
  if (high.length)
    arr.push({
      sev: 1,
      title: "High-effort work",
      text: `${high.length} sets were RPE 9–10. Useful for context when performance dips.`,
    });
  const incomplete = db.sets.filter((s) => !s.complete);
  if (incomplete.length)
    arr.push({
      sev: 1,
      title: "Incomplete records preserved",
      text: `${incomplete.length} records have a missing or approximate value rather than guessed data.`,
    });
  flags.innerHTML =
    arr
      .map(
        (x) =>
          `<div class="item"><strong>${esc(x.title)}</strong><div class="sub">${esc(x.text)}</div></div>`,
      )
      .join("") || '<div class="sub">No flags.</div>';
}
function latestSet(ex) {
  return db.sets
    .filter((s) => s.exercise === ex && isComplete(s))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}
function loadExerciseToForm(ex) {
  // A plan's Log action always starts a new set, never repurposes an edit.
  if (editingSetId) clearForm();
  fExercise.value = ex;
  const last = latestSet(ex);
  if (last) {
    fWeight.value = last.weight ?? "";
    fUnit.value = last.unit || "lb";
  }
  document.querySelector('[data-view=\"workout\"]').click();
  fReps.focus();
}
function startTemplate(id, duration = 60) {
  if (
    changeDB((next) => {
      next.program.activeTemplateId = id;
      next.program.activeDuration = duration;
    })
  )
    document.querySelector('[data-view="workout"]').click();
}
function clearActivePlan() {
  changeDB((next) => {
    next.program.activeTemplateId = null;
  });
}
function renderToday() {
  const d = fDate.value || today();
  const rows = db.sets.filter((s) => s.date === d);
  const t = db.program?.templates?.find(
    (x) => x.id === db.program.activeTemplateId,
  );
  const dur = db.program?.activeDuration || 60;
  const visibleSlots = t
    ? dur === 30
      ? t.slots.filter((s) => s.short)
      : t.slots
    : [];
  activePlanLabel.textContent = t
    ? `${t.name} • ${t.intensity} • ${dur}-minute plan`
    : "No template selected.";
  todayPlan.innerHTML = t
    ? visibleSlots
        .map((slot) => {
          const meta = db.exerciseLibrary?.[slot.exercise] || {};
          const last = latestSet(slot.exercise);
          const pref = hasOwn(db.preferences, slot.exercise)
            ? db.preferences[slot.exercise]
            : null;
          return `<div class="item role-${slot.role}"><div class="split"><div><strong>${esc(slot.exercise)} <span class="pill">${slot.role}</span></strong><div class="sub">${esc(meta.primary || "Uncategorized")} • ${esc(meta.pattern || "")}</div>${last ? `<div class="sub">Last: ${fmt(last.weight)} ${esc(last.unit)} × ${fmt(last.reps)} on ${last.date}</div>` : ""}${pref ? `<div class="sub">${esc(pref)}</div>` : ""}</div><button class="btn small" onclick="loadExerciseToForm(${jsArg(slot.exercise)})">Log</button></div></div>`;
        })
        .join("")
    : '<div class="sub">Choose a workout from the Program tab to load your regular exercises here.</div>';
  todaySets.innerHTML = rows.length
    ? rows
        .map(
          (s) =>
            `<div class="item"><div class="split"><div><strong>${esc(s.exercise)}</strong><div class="sub">${fmt(s.weight)} ${esc(s.unit)} × ${fmt(s.reps)} ${s.rpe != null ? "• RPE " + s.rpe : ""}${s.rir != null ? " • " + s.rir + " RIR" : ""}${s.pain ? " • pain " + s.pain + "/10 " + esc(s.painArea) : ""}</div>${s.notes ? `<div class="sub">${esc(s.notes)}</div>` : ""}</div><div class="plan-actions"><button class="btn small secondary" onclick="editSet(${jsArg(s.id)})">Edit</button><button class="btn small danger" onclick="deleteSet(${jsArg(s.id)})">Delete</button></div></div></div>`,
        )
        .join("")
    : `<div class="sub">No sets logged for ${d}.</div>`;
}

function renderHistory() {
  const filter = historyFilter?.value || "all";
  let rows = [...db.sets].sort((a, b) => b.date.localeCompare(a.date));
  if (filter !== "all") rows = rows.filter((s) => s.source === filter);
  historyTable.innerHTML = `<table><thead><tr><th>Date</th><th>Exercise</th><th>Load</th><th>Reps</th><th>Effort</th><th>Pain</th><th>Notes</th><th>Source</th><th>Actions</th></tr></thead><tbody>${rows.map((s) => `<tr><td>${s.date}</td><td>${esc(s.exercise)}</td><td>${fmt(s.weight)} ${esc(s.unit)}</td><td>${fmt(s.reps)}</td><td>${s.rpe != null ? "RPE " + s.rpe : s.rir != null ? s.rir + " RIR" : "—"}</td><td>${s.pain ? `${s.pain}/10 ${esc(s.painArea)}` : "—"}</td><td>${esc(s.notes || "")}</td><td><span class="pill ${s.complete ? "" : "warn"}">${esc(s.source)}${s.complete ? "" : " • incomplete"}</span></td><td><button class="btn small secondary" onclick="editSet(${jsArg(s.id)})">Edit</button> <button class="btn small danger" onclick="deleteSet(${jsArg(s.id)})">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function renderExercises() {
  const xs = allExercises();
  exerciseTable.innerHTML = `<table><thead><tr><th>Exercise</th><th>Primary</th><th>Role</th><th>Sets</th><th>Last</th></tr></thead><tbody>${xs
    .map((ex) => {
      const r = db.sets
        .filter((s) => s.exercise === ex)
        .sort((a, b) => b.date.localeCompare(a.date));
      const m = db.exerciseLibrary?.[ex] || {};
      return `<tr class="exercise-row" onclick="showExercise(${jsArg(ex)})"><td>${esc(ex)}</td><td>${esc(m.primary || "Uncategorized")}</td><td>${esc(m.status || "")}</td><td>${r.length}</td><td>${r[0]?.date || "—"}</td></tr>`;
    })
    .join("")}</tbody></table>`;
  if (xs.length)
    showExercise(xs.includes(selectedExercise) ? selectedExercise : xs[0]);
  else {
    exerciseDetailTitle.textContent = "Exercise detail";
    exerciseDetail.textContent = "No exercises yet.";
    lineChart(exerciseChart, []);
  }
}
function showExercise(ex) {
  selectedExercise = ex;
  exerciseDetailTitle.textContent = ex;
  const r = db.sets
    .filter((s) => s.exercise === ex)
    .sort((a, b) => a.date.localeCompare(b.date));
  const complete = performanceRows(ex).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const best = [...complete].sort((a, b) => volume(b) - volume(a))[0];
  // Latest history is independent of eligibility for load-based rankings.
  const latest = r.filter((s) => s.weight != null && s.reps != null).at(-1);
  const pain = r.filter((s) => s.pain > 0);
  const pref = hasOwn(db.preferences, ex) ? db.preferences[ex] : null;
  const meta = db.exerciseLibrary?.[ex] || {};
  exerciseDetail.innerHTML = `<div>${meta.primary ? `<span class="muscle-tag">Primary: ${esc(meta.primary)}</span>` : ""}${(meta.secondary || []).map((x) => `<span class="muscle-tag">${esc(x)}</span>`).join("")}${meta.pattern ? `<span class="muscle-tag">${esc(meta.pattern)}</span>` : ""}</div>${pref ? `<div class="notice" style="margin-top:8px">${esc(pref)}</div>` : ""}<div class="grid cols2" style="margin-top:10px"><div><div class="label">Best comparable set-work</div><div><strong>${best ? fmt(best.weight) + " " + esc(best.unit) + " × " + fmt(best.reps) : "—"}</strong></div></div><div><div class="label">Latest</div><div><strong>${latest ? fmt(latest.weight) + " " + esc(latest.unit) + " × " + fmt(latest.reps) : "—"}</strong></div></div><div><div class="label">Pain events</div><div><strong>${pain.length}</strong></div></div><div><div class="label">Sessions</div><div><strong>${unique(r.map((s) => s.date)).length}</strong></div></div></div>`;
  lineChart(
    exerciseChart,
    bestByDate(ex).map((x) => ({ v: x.v, label: x.label })),
    (v) => Math.round(v),
  );
}

let inboxDraft = null;
function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function normalizeInboxPayload(x) {
  requireValue(isObject(x), "Workout JSON must be an object.");
  requireValue(
    x.schema == null || x.schema === "gym-tracker-chatgpt-v1",
    "Unsupported import schema.",
  );
  const src = x.session ?? x.workout ?? x;
  requireValue(isObject(src), "Workout must be an object.");
  const text = (value, fallback = "") => {
    requireValue(
      value == null || typeof value === "string",
      "Text fields must contain text.",
    );
    return value ?? fallback;
  };
  const date = text(src.date ?? x.date);
  const template = text(src.template ?? src.workoutTemplate);
  const duration = numeric(src.duration ?? src.durationMinutes);
  const sessionNotes = text(src.notes ?? src.sessionNotes);
  const bodyweight = numeric(src.bodyweight ?? src.bodyWeight);
  requireValue(
    !(src.sets != null && src.exercises != null),
    "Supply sets or exercises, not both.",
  );
  let rows = [];
  if (src.sets != null) {
    requireValue(Array.isArray(src.sets), "Sets must be an array.");
    rows = src.sets;
  }
  if (src.exercises != null) {
    requireValue(Array.isArray(src.exercises), "Exercises must be an array.");
    src.exercises.forEach((e) => {
      requireValue(
        isObject(e) && Array.isArray(e.sets),
        "Each exercise needs a sets array.",
      );
      e.sets.forEach((z, i) => {
        requireValue(isObject(z), "Invalid set.");
        rows.push({
          ...z,
          exercise: z.exercise ?? e.exercise ?? e.name,
          setNumber: z.setNumber ?? i + 1,
        });
      });
    });
  }
  const sets = rows.map((z, i) => {
    requireValue(isObject(z), "Invalid set.");
    requireValue(
      z.complete == null || typeof z.complete === "boolean",
      "Complete must be true or false.",
    );
    return {
      include: z.include !== false,
      exercise: text(z.exercise ?? z.name).trim(),
      weight: numeric(z.weight),
      unit: text(z.unit, "lb"),
      reps: numeric(z.reps),
      rpe: numeric(z.rpe),
      rir: numeric(z.rir),
      pain: numeric(z.pain) ?? 0,
      painArea: text(z.painArea ?? z.pain_area),
      notes: text(z.notes),
      complete: z.complete !== false,
      setNumber: z.setNumber ?? i + 1,
    };
  });
  // Retain V1.5 generated IDs, including its completeness representation.
  const legacySets = sets.map(({ include, ...z }, i) => ({
    ...z,
    complete:
      rows[i].complete !== false &&
      rows[i].weight != null &&
      rows[i].reps != null,
  }));
  const importId =
    text(x.importId ?? x.import_id ?? src.importId ?? src.import_id) ||
    simpleHash(JSON.stringify({ date, template, duration, sets: legacySets }));
  return { importId, date, template, duration, sessionNotes, bodyweight, sets };
}
function validateDraft(d) {
  const issues = [];
  if (!validDate(d.date))
    issues.push("Choose a real workout date (YYYY-MM-DD).");
  if (d.duration != null && !validNumber(d.duration, Number.MIN_VALUE))
    issues.push("Duration must be a positive number.");
  if (d.bodyweight != null && !validNumber(d.bodyweight, Number.MIN_VALUE))
    issues.push("Bodyweight must be a positive number.");
  const selected = d.sets.filter((s) => s.include);
  if (!selected.length) issues.push("Select at least one set.");
  d.sets.forEach((s, i) => {
    if (s.include)
      setErrors(s).forEach((error) => issues.push(`Set ${i + 1}: ${error}`));
  });
  return issues;
}
function parseInbox() {
  try {
    inboxDraft = normalizeInboxPayload(JSON.parse(inboxRaw.value));
    renderInboxDraft();
  } catch (error) {
    clearInbox(false);
    inboxStatus.innerHTML = `<div class="notice status-bad"><strong>Could not read workout JSON.</strong><div class="sub">${esc(error.message)}</div></div>`;
  }
}
function updateDraft(index, key, value) {
  inboxDraft.sets[index][key] = value;
  renderInboxDraft();
}
function renderInboxDraft() {
  if (!inboxDraft) return;
  const dup = db.imports.some((x) => x.importId === inboxDraft.importId);
  const issues = validateDraft(inboxDraft);
  const warnings = [];
  inboxDraft.sets.forEach((s, i) => {
    if (!s.include) return;
    if (s.exercise && !hasOwn(db.exerciseLibrary, s.exercise))
      warnings.push(
        `Set ${i + 1}: unknown exercise will be added as Uncategorized.`,
      );
    if (s.weight == null || s.reps == null || !s.complete)
      warnings.push(
        `Set ${i + 1}: incomplete or approximate; excluded from performance calculations.`,
      );
  });
  inboxStatus.innerHTML = dup
    ? '<div class="notice status-bad"><strong>Duplicate import detected.</strong></div>'
    : issues.length
      ? '<div class="notice status-bad"><strong>Correct the errors below before committing.</strong></div>'
      : warnings.length
        ? '<div class="notice status-warn"><strong>Ready with review notes.</strong></div>'
        : '<div class="notice status-ok"><strong>Ready to commit.</strong></div>';
  const displayNumber = (value) => (Number.isFinite(value) ? value : "");
  inboxMeta.innerHTML = `<div class="grid cols2"><div><label class="label">Date</label><input aria-label="Import date" value="${esc(inboxDraft.date)}" onchange="inboxDraft.date=this.value;renderInboxDraft()"></div><div><label class="label">Template</label><input aria-label="Import template" value="${esc(inboxDraft.template)}" onchange="inboxDraft.template=this.value"></div><div><label class="label">Duration</label><input aria-label="Import duration" type="number" value="${displayNumber(inboxDraft.duration)}" onchange="inboxDraft.duration=numeric(this.value);renderInboxDraft()"></div><div><label class="label">Bodyweight</label><input aria-label="Import bodyweight" type="number" step="0.1" value="${displayNumber(inboxDraft.bodyweight)}" onchange="inboxDraft.bodyweight=numeric(this.value);renderInboxDraft()"></div><div><label class="label">Session notes</label><textarea aria-label="Import session notes" onchange="inboxDraft.sessionNotes=this.value">${esc(inboxDraft.sessionNotes)}</textarea></div></div>${issues.length || warnings.length ? `<div class="item" style="margin-top:10px"><strong>Review notes</strong><div class="sub">${[...issues, ...warnings].map(esc).join("<br>")}</div></div>` : ""}`;
  const numberInput = (x, i, key, label, step = "1") =>
    `<label class="label">${label}<input aria-label="Set ${i + 1} ${label}" type="number" step="${step}" value="${displayNumber(x[key])}" onchange="updateDraft(${i},'${key}',numeric(this.value))"></label>`;
  inboxReview.innerHTML =
    inboxDraft.sets
      .map(
        (x, i) =>
          `<div class="inbox-set"><div><label class="checkline"><input aria-label="Include set ${i + 1}" type="checkbox" ${x.include ? "checked" : ""} onchange="updateDraft(${i},'include',this.checked)"> Include set ${i + 1}</label><input aria-label="Set ${i + 1} exercise" list="exerciseList" value="${esc(x.exercise)}" onchange="updateDraft(${i},'exercise',this.value.trim())"><label class="checkline"><input type="checkbox" ${!x.complete ? "checked" : ""} onchange="updateDraft(${i},'complete',!this.checked)"> Approximate</label></div>${numberInput(x, i, "weight", "Weight", "any")}<label class="label">Unit<select aria-label="Set ${i + 1} unit" onchange="updateDraft(${i},'unit',this.value)">${!UNITS.includes(x.unit) ? '<option value="" selected>Choose unit</option>' : ""}${UNITS.map((u) => `<option ${x.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></label>${numberInput(x, i, "reps", "Reps")}${numberInput(x, i, "rpe", "RPE", "0.5")}${numberInput(x, i, "rir", "RIR")}${numberInput(x, i, "pain", "Pain", "any")}<div><label class="label">Notes<input aria-label="Set ${i + 1} notes" value="${esc(x.notes)}" onchange="inboxDraft.sets[${i}].notes=this.value"></label><label class="label">Pain area<input aria-label="Set ${i + 1} pain area" value="${esc(x.painArea)}" onchange="inboxDraft.sets[${i}].painArea=this.value"></label></div><button class="btn small danger" aria-label="Remove set ${i + 1}" onclick="inboxDraft.sets.splice(${i},1);renderInboxDraft()">×</button></div>`,
      )
      .join("") || '<div class="sub">No sets found.</div>';
  commitInboxBtn.disabled = dup || issues.length > 0;
}
function commitInbox() {
  if (!inboxDraft) return;
  const issues = validateDraft(inboxDraft);
  if (issues.length) {
    alert(issues.join("\n"));
    return;
  }
  if (db.imports.some((x) => x.importId === inboxDraft.importId)) {
    alert("That workout has already been imported.");
    return;
  }
  const chosen = inboxDraft.sets.filter((s) => s.include);
  const batch = "cg_" + inboxDraft.importId;
  if (
    !changeDB((next) => {
      chosen.forEach((s, i) => {
        ensureExercise(next, s.exercise);
        next.sets.push({
          id: batch + "_" + String(i + 1).padStart(2, "0"),
          date: inboxDraft.date,
          exercise: s.exercise,
          weight: s.weight,
          unit: s.unit,
          reps: s.reps,
          rpe: s.rpe,
          rir: s.rir,
          pain: s.pain,
          painArea: s.painArea,
          notes: s.notes,
          source: "chatgpt",
          complete: s.complete && s.weight != null && s.reps != null,
          importBatch: batch,
          setNumber: i + 1,
        });
      });
      if (inboxDraft.bodyweight != null)
        next.bodyweights.push({
          date: inboxDraft.date,
          value: inboxDraft.bodyweight,
          source: "chatgpt",
          importBatch: batch,
        });
      next.imports.push({
        importId: inboxDraft.importId,
        batch,
        date: inboxDraft.date,
        template: inboxDraft.template,
        duration: inboxDraft.duration,
        setCount: chosen.length,
        notes: inboxDraft.sessionNotes,
        committedAt: new Date().toISOString(),
      });
    })
  )
    return;
  clearInbox(false);
  inboxStatus.innerHTML = `<div class="notice status-ok"><strong>Committed ${chosen.length} sets.</strong><div class="sub">They are now in Workout History and analytics.</div></div>`;
}
function clearInbox(clearText = true) {
  inboxDraft = null;
  if (clearText) inboxRaw.value = "";
  inboxMeta.innerHTML = "";
  inboxReview.innerHTML =
    '<div class="sub">Paste a workout above to begin.</div>';
  inboxStatus.innerHTML = '<div class="sub">No workout staged.</div>';
  commitInboxBtn.disabled = true;
}
function loadInboxFile(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    inboxRaw.value = r.result;
    parseInbox();
  };
  r.readAsText(f);
  ev.target.value = "";
}
function downloadInboxExample() {
  const x = {
    schema: "gym-tracker-chatgpt-v1",
    importId: "example-2026-10-22-pull",
    date: "2026-10-22",
    template: "B — Pull + Arms",
    duration: 60,
    bodyweight: null,
    notes: "Example only",
    exercises: [
      {
        exercise: "Seated Row",
        sets: [
          {
            weight: 100,
            unit: "lb",
            reps: 12,
            rpe: 7,
            rir: null,
            pain: 0,
            painArea: "",
            notes: "clean",
          },
        ],
      },
      {
        exercise: "Lat Pulldown",
        sets: [
          {
            weight: 100,
            unit: "lb",
            reps: 10,
            rpe: null,
            rir: 2,
            pain: 0,
            painArea: "",
            notes: "",
          },
        ],
      },
    ],
  };
  download(
    "gymbro-chatgpt-example.json",
    "application/json",
    JSON.stringify(x, null, 2),
  );
}
function renderImportHistory() {
  if (!document.getElementById("importHistory")) return;
  const xs = [...(db.imports || [])].sort((a, b) =>
    (b.committedAt || "").localeCompare(a.committedAt || ""),
  );
  importHistory.innerHTML = xs.length
    ? xs
        .slice(0, 10)
        .map(
          (x) =>
            `<div class="item"><div class="split"><div><strong>${esc(x.date)}${x.template ? " • " + esc(x.template) : ""}</strong><div class="sub">${x.setCount} sets${x.duration ? " • " + x.duration + " min" : ""} • import ${esc(x.importId)}</div></div>${x.notes ? `<div class="sub">${esc(x.notes)}</div>` : ""}<span class="pill good">committed</span></div></div>`,
        )
        .join("")
    : '<div class="sub">No ChatGPT imports yet.</div>';
}
function roleLabel(r) {
  return r === "core" ? "Core" : r === "accessory" ? "Accessory" : "Substitute";
}
function renderProgram() {
  if (!db.program) return;
  programTemplates.innerHTML = db.program.templates
    .map(
      (t) =>
        `<div class="item template-card" onclick="editTemplate(${jsArg(t.id)})"><div class="split"><div><strong>${esc(t.name)}</strong><div class="sub">${esc(t.focus)} • ${esc(t.intensity)} • ${t.slots.filter((s) => s.role === "core").length} core</div></div><div class="plan-actions"><button class="btn small" onclick="event.stopPropagation();startTemplate(${jsArg(t.id)},60)">60 min</button><button class="btn small secondary" onclick="event.stopPropagation();startTemplate(${jsArg(t.id)},30)">30 min</button></div></div></div>`,
    )
    .join("");
  const counts = Object.create(null);
  Object.entries(db.exerciseLibrary || {}).forEach(([ex, m]) =>
    (counts[m.primary || "Uncategorized"] ??= []).push(ex),
  );
  taxonomySummary.innerHTML = `<table><thead><tr><th>Primary group</th><th>Exercises</th></tr></thead><tbody>${Object.entries(
    counts,
  )
    .sort()
    .map(
      ([g, xs]) =>
        `<tr><td><strong>${esc(g)}</strong></td><td>${xs.map((x) => `<span class="muscle-tag">${esc(x)}</span>`).join("")}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function editTemplate(id) {
  selectedTemplateId = id;
  const t = db.program.templates.find((x) => x.id === id);
  if (!t) {
    selectedTemplateId = null;
    templateEditorTitle.textContent = "Workout template";
    templateEditor.textContent = "Select a workout.";
    return;
  }
  templateEditorTitle.textContent = t.name;
  templateEditor.innerHTML = `<div class="sub">${esc(t.focus)} • ${esc(t.intensity)}</div><div class="list" style="margin-top:10px">${t.slots
    .map((s, i) => {
      const m = db.exerciseLibrary?.[s.exercise] || {};
      return `<div class="item role-${s.role}"><div class="split"><div><strong>${esc(s.exercise)}</strong><div class="sub">${roleLabel(s.role)} • ${s.short ? "30-min core • " : ""}${esc(m.primary || "Uncategorized")} • ${esc(m.pattern || "")}</div></div><div class="plan-actions"><button class="btn small secondary" onclick="toggleShort(${jsArg(id)},${i})">30m</button><button class="btn small secondary" onclick="cycleRole(${jsArg(id)},${i})">Role</button><button class="btn small danger" onclick="removeSlot(${jsArg(id)},${i})">Remove</button></div></div></div>`;
    })
    .join(
      "",
    )}</div><div style="margin-top:12px"><div class="label">Add exercise</div><div class="formgrid"><div class="span3"><input id="addEx_${esc(id)}" list="exerciseList" placeholder="Exercise"></div><div class="span2"><select id="addRole_${esc(id)}"><option value="accessory">Accessory</option><option value="core">Core</option><option value="substitute">Substitute</option></select></div><div><button onclick="addSlot(${jsArg(id)})">Add</button></div></div></div>`;
}
function toggleShort(id, i) {
  changeDB((next) => {
    const s = next.program.templates.find((x) => x.id === id).slots[i];
    s.short = !s.short;
  });
}
function cycleRole(id, i) {
  changeDB((next) => {
    const s = next.program.templates.find((x) => x.id === id).slots[i];
    s.role =
      s.role === "core"
        ? "accessory"
        : s.role === "accessory"
          ? "substitute"
          : "core";
  });
}
function removeSlot(id, i) {
  changeDB((next) =>
    next.program.templates.find((x) => x.id === id).slots.splice(i, 1),
  );
}
function addSlot(id) {
  const ex = document.getElementById("addEx_" + id).value.trim();
  const role = document.getElementById("addRole_" + id).value;
  if (!safeName(ex)) {
    alert("Enter an exercise name.");
    return;
  }
  changeDB((next) => {
    ensureExercise(next, ex);
    next.program.templates
      .find((x) => x.id === id)
      .slots.push({ exercise: ex, role, short: false });
  });
}
function download(name, type, text) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(
    `gymbro-backup-${today()}.json`,
    "application/json",
    JSON.stringify(db, null, 2),
  );
}
function quickBackup() {
  exportJSON();
}
function csvText(value) {
  const text = String(value ?? "");
  return typeof value === "string" && /^[\s]*[=+@-]/.test(text)
    ? "'" + text
    : text;
}
function exportCSV() {
  const h = [
    "date",
    "exercise",
    "weight",
    "unit",
    "reps",
    "rpe",
    "rir",
    "pain",
    "painArea",
    "notes",
    "source",
    "complete",
  ];
  const rows = [h.join(",")].concat(
    db.sets.map((s) =>
      h.map((k) => `"${csvText(s[k]).replace(/"/g, '""')}"`).join(","),
    ),
  );
  download(`gym-sets-${today()}.csv`, "text/csv", rows.join("\n"));
}
function importJSON() {
  const file = importFile.files[0];
  if (!file) return;
  const mode = document.getElementById("backupMode").value;
  const reader = new FileReader();
  reader.onerror = () => alert("Could not read that file.");
  reader.onload = () => {
    try {
      const restored = migrateData(JSON.parse(reader.result));
      if (
        !confirm(
          mode === "restore"
            ? "Replace ALL current data with this backup, including program and preferences? Export your current backup first."
            : "Merge history from this backup? Current program and preferences will be kept.",
        )
      )
        return;
      let next = restored;
      if (mode === "merge") {
        if (storageState.blocked)
          throw Error(
            "Restore a complete backup to recover unreadable storage.",
          );
        next = structuredClone(db);
        const ids = new Set(next.sets.map((s) => s.id));
        for (const set of restored.sets) {
          if (!ids.has(set.id)) {
            next.sets.push(set);
            ids.add(set.id);
            ensureExercise(next, set.exercise);
          }
        }
        const weights = new Set(
          next.bodyweights.map((w) => JSON.stringify([w.date, w.value])),
        );
        for (const row of restored.bodyweights) {
          const key = JSON.stringify([row.date, row.value]);
          if (!weights.has(key)) {
            next.bodyweights.push(row);
            weights.add(key);
          }
        }
        const imports = new Set(next.imports.map((i) => i.importId));
        for (const row of restored.imports)
          if (!imports.has(row.importId)) {
            next.imports.push(row);
            imports.add(row.importId);
          }
        for (const row of next.imports)
          if (row.batch)
            row.setCount = next.sets.filter(
              (s) => s.importBatch === row.batch,
            ).length;
      }
      if (save(next, mode === "restore")) {
        db = next;
        clearForm();
        clearInbox();
        selectedTemplateId = null;
        templateEditor.textContent = "Select a workout to edit.";
        templateEditorTitle.textContent = "Workout template";
        renderAll();
        alert(
          mode === "restore"
            ? "Backup restored completely."
            : "History merged. Current settings preserved.",
        );
      }
    } catch (error) {
      alert("Backup was not imported: " + error.message);
    }
  };
  reader.readAsText(file);
}
function resetSeed() {
  if (confirm("Restore the original seed and discard local changes?")) {
    const next = migrateData(seed);
    if (save(next)) {
      db = next;
      clearForm();
      clearInbox();
      renderAll();
    }
  }
}
function clearAll() {
  if (
    confirm(
      "Erase ALL local workout data and restore default program settings?",
    )
  ) {
    const next = emptyData();
    next.preferences = {};
    if (save(next)) {
      db = next;
      clearForm();
      clearInbox();
      renderAll();
    }
  }
}

fDate.addEventListener("change", renderToday);
setDefaultDates();
renderAll();
renderStorageNotice();
// Never write on startup: invalid or future-version data remains recoverable.
