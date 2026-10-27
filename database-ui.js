let databaseClient = null,
  databaseStore = null,
  databaseUser = null,
  databasePreviewState = null,
  databaseUIBusy = false,
  databaseEpoch = 0,
  databaseSessionLoad = null;
const localOriginalValid = !storageState.blocked;
const databaseMessage = (text) => {
  document.getElementById("databaseMessage").textContent = text;
};
function databaseStatus(text) {
  document.getElementById("databaseStatus").textContent = text;
  document.getElementById("eraseDataButton").textContent =
    storageState.mode === "local"
      ? "Erase all local data"
      : "Erase all account data";
}
function databaseChanged() {
  databasePreviewState = null;
  document.getElementById("databasePreview").hidden = true;
}
async function databaseTask(fn) {
  let acquired = false;
  try {
    await databaseStartup;
    if (databaseUIBusy || uiSaveBusy || databaseStore?.busy)
      throw Error("Wait for the current save.");
    databaseUIBusy = true;
    acquired = true;
    await fn();
  } catch (error) {
    databaseMessage(error.message);
  } finally {
    if (acquired) databaseUIBusy = false;
  }
}
async function databaseLoadSession(session) {
  if (session && databaseUser === session.user.id) {
    if (databaseSessionLoad) return databaseSessionLoad;
    if (databaseStore?.ready) return;
  }
  const epoch = ++databaseEpoch;
  if (!session) {
    databaseUser = null;
    databaseSessionLoad = null;
    databaseStore?.signOut();
    databaseChanged();
    databaseStatus("Signed out · displayed data is read-only");
    return;
  }
  databaseUser = session.user.id;
  databaseChanged();
  databaseStatus("Loading database · " + session.user.email);
  const task = (async () => {
    try {
      if (!databaseStore)
        databaseStore = createSupabaseStore({
          transport: createSupabaseTransport(databaseClient),
          validate: validateData,
          storage: {
            getItem: (k) => sessionStorage.getItem(k),
            setItem: (k, v) => sessionStorage.setItem(k, v),
            removeItem: (k) => sessionStorage.removeItem(k),
          },
        });
      storageState.remote = databaseStore;
      const state = await databaseStore.open(session.user.id);
      if (epoch !== databaseEpoch) return;
      if (state) {
        db = state;
        cacheDatabaseView(state);
        clearForm();
        clearInbox();
        storageState.message = "";
        renderAll();
        renderStorageNotice();
        databaseStatus("Supabase database · " + session.user.email);
        databaseMessage(
          "Database data loaded. Saves require a confirmed database commit.",
        );
      } else {
        databaseStatus("Account has no workout data · import or start empty");
        databaseMessage(
          "Review your V2 local data or start an empty account. Nothing is uploaded automatically.",
        );
      }
    } catch (error) {
      if (epoch === databaseEpoch) {
        databaseStatus("Database unavailable · displayed data is read-only");
        databaseMessage(error.message);
      }
    }
  })();
  databaseSessionLoad = task;
  try {
    await task;
  } finally {
    if (databaseSessionLoad === task) databaseSessionLoad = null;
  }
}
const databaseStartup = (async () => {
  if (location.protocol === "file:") {
    storageState.mode = "local";
    databaseStatus("Legacy local mode · database unavailable on file URLs");
    return;
  }
  try {
    const response = await fetch("/api/config");
    if (response.status === 404) {
      if (storageState.mode === "cloud") {
        databaseStatus("Database unavailable · displayed cache is read-only");
        return;
      }
      storageState.mode = "local";
      databaseStatus("Legacy local mode · static server");
      return;
    }
    const config = await response.json();
    if (response.ok && config.enabled === false) {
      if (storageState.mode === "cloud") {
        databaseStatus("Database unavailable · displayed cache is read-only");
        return;
      }
      storageState.mode = "local";
      databaseStatus("Legacy local mode · Supabase is not configured");
      return;
    }
    storageState.mode = "cloud";
    if (!response.ok || !config.enabled)
      throw Error(
        config.error || "Database configuration could not be loaded.",
      );
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/api/supabase-sdk";
      script.onload = resolve;
      script.onerror = () =>
        reject(Error("Could not load the Supabase browser SDK."));
      document.head.append(script);
    });
    databaseClient = supabase.createClient(config.url, config.key, {
      auth: {
        storage: sessionStorage,
        storageKey: "gymbroDatabaseAuth",
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        detectSessionInUrl: true,
      },
    });
    const { data, error } = await databaseClient.auth.getSession();
    if (error) throw error;
    await databaseLoadSession(data.session);
    databaseClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        databaseLoadSession(session).catch(() =>
          databaseMessage("Account state could not be loaded."),
        );
      }, 0);
    });
  } catch (error) {
    storageState.mode = "cloud";
    databaseStatus("Database unavailable · displayed data is read-only");
    databaseMessage(error.message);
  }
})();
function databaseLogin(create) {
  return databaseTask(async () => {
    if (!databaseClient)
      throw Error(
        "Configure the Supabase URL and publishable key in this Vercel project first.",
      );
    if (!confirmDiscardSetInput()) return;
    const credentials = {
      email: document.getElementById("databaseEmail").value.trim(),
      password: document.getElementById("databasePassword").value,
    };
    try {
      const result = create
        ? await databaseClient.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: location.origin },
          })
        : await databaseClient.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      await databaseLoadSession(result.data.session);
      if (!result.data.session)
        databaseMessage(
          "Check your email to confirm the account, then sign in.",
        );
    } finally {
      document.getElementById("databasePassword").value = "";
    }
  });
}
function databaseLogout() {
  return databaseTask(async () => {
    if (!databaseClient) throw Error("No database account is connected.");
    const { error } = await databaseClient.auth.signOut({ scope: "local" });
    if (error) throw error;
    await databaseLoadSession(null);
    databaseMessage(
      "Signed out. The displayed dataset was retained read-only; no local history was replaced.",
    );
  });
}
function databaseReload() {
  return databaseTask(async () => {
    if (!databaseUser || !databaseStore) throw Error("Sign in first.");
    if (!confirmDiscardSetInput()) return;
    const state = await databaseStore.open(databaseUser);
    if (state) {
      db = state;
      cacheDatabaseView(state);
      clearForm();
      clearInbox();
      storageState.message = "";
      renderAll();
      renderStorageNotice();
      databaseStatus("Supabase database");
      databaseMessage(
        "Database data reloaded. Inspect current history before retrying edits.",
      );
    } else
      databaseMessage(
        "This account has no data. Preview an import or empty account.",
      );
  });
}
function databasePreview(empty) {
  return databaseTask(async () => {
    if (!databaseUser || !databaseStore?.ready)
      throw Error("Sign in and load your account first.");
    if (databaseStore.hasState)
      throw Error(
        "This account already contains data. Use Data → Restore or Merge for an explicit account operation.",
      );
    if (!empty && !localOriginalValid)
      throw Error(
        "Original local data is unreadable. Download it first. You can create an empty cloud account and explicitly restore a valid backup from Data.",
      );
    const candidate = empty ? emptyData() : structuredClone(legacySnapshot);
    if (empty) candidate.preferences = {};
    validateData(candidate);
    databasePreviewState = {
      candidate,
      userId: databaseUser,
      signature: canonicalWorkoutJSON(candidate),
    };
    document.getElementById("databasePreviewSummary").textContent =
      `Schema 7 · ${candidate.sets.length} sets · ${candidate.sessions.length} sessions · ${candidate.bodyweights.length} bodyweights · ${candidate.imports.length} imports · ${candidate.program.templates.length} templates. Active workout: ${candidate.activeSessionId ? "present" : "none"}. The complete reviewed state, IDs, guidance and metadata will be copied. Original local data will remain unchanged.`;
    document.getElementById("databasePreview").hidden = false;
  });
}
function databaseCommit() {
  return databaseTask(async () => {
    const preview = databasePreviewState;
    if (
      !preview ||
      preview.userId !== databaseUser ||
      preview.signature !== canonicalWorkoutJSON(preview.candidate)
    )
      throw Error("Preview the current dataset again.");
    if (
      !confirmDiscardSetInput() ||
      !confirm(
        "Copy exactly the reviewed dataset into this empty Supabase account, verify the database read-back, and use database storage? Original local data will remain unchanged.",
      )
    )
      return;
    const state = await databaseStore.initialize(
      preview.candidate,
      canonicalWorkoutJSON,
    );
    if (databaseUser !== preview.userId)
      throw Error("Account changed. Reload the database.");
    db = state;
    cacheDatabaseView(state);
    databaseChanged();
    clearForm();
    clearInbox();
    renderAll();
    databaseStatus("Supabase database");
    databaseMessage(
      "Import committed and read-back verified. Workouts now save to Supabase. Original local data is unchanged.",
    );
  });
}
function databaseDownloadLocal() {
  // Available even when auth, network, pending-save resolution or database configuration fails.
  if (storageState.raw !== null)
    download(
      "gymbro-original-local.json",
      "application/json",
      storageState.raw,
    );
  else
    download(
      "gymbro-local-snapshot.json",
      "application/json",
      JSON.stringify(createCompleteBackup(legacySnapshot), null, 2),
    );
}
function databaseResolve() {
  return databaseTask(async () => {
    if (!databaseStore?.ready)
      throw Error("Sign in and load the same account first.");
    if (!confirmDiscardSetInput()) return;
    const state = await databaseStore.resolve();
    if (state) {
      db = state;
      cacheDatabaseView(state);
      clearForm();
      clearInbox();
      renderAll();
      databaseStatus("Supabase database");
      databaseMessage(
        "Save resolved against the database. Inspect history before entering another set.",
      );
    }
  });
}
