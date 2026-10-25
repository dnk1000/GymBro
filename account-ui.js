let accountClient = null;
let consentDetails = null;
const accountMessage = (text) => {
  document.getElementById("accountMessage").textContent = text;
};
function renderAccount() {
  document.getElementById("authorityStatus").textContent = connection.status;
  document.getElementById("accountStatus").textContent = connection.session
    ? "Signed in as " +
      connection.session.user.email +
      (connection.ownerId && connection.ownerId !== connection.session.user.id
        ? " · displayed cache belongs to a different account"
        : "")
    : "Signed out. " +
      (connection.isLocal()
        ? "Local data is authoritative."
        : "Displayed connected data is cached and read-only.");
  document.getElementById("accountImport").hidden = !connection.preview;
  if (connection.preview) {
    const s = connection.preview.summary;
    document.getElementById("accountImportSummary").textContent =
      `Review: ${s.sets} sets, ${s.sessions} sessions, ${s.bodyweights} bodyweights, ${s.imports} imports, schema ${s.schema}. Active session: ${s.activeSessionId ? "present" : "none"}. Original local data will remain unchanged.`;
  }
}
async function accountTask(fn) {
  try {
    await accountReady;
    await fn();
  } catch (e) {
    accountMessage(e.message);
  } finally {
    renderAccount();
  }
}
const accountReady = (async () => {
  renderAccount();
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    if (!config.enabled) {
      accountMessage(
        "Connected accounts are not configured in this environment. Local-only mode remains available.",
      );
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/api/sdk";
      script.onload = resolve;
      script.onerror = () =>
        reject(Error("Could not load account authentication."));
      document.head.append(script);
    });
    accountClient = supabase.createClient(config.url, config.key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    const { data, error } = await accountClient.auth.getSession();
    if (error) throw error;
    connection.auth(data.session);
    accountClient.auth.onAuthStateChange((_event, session) => {
      connection.auth(session);
    });
    if (new URLSearchParams(location.search).has("authorization_id"))
      setTimeout(() => accountLoadConsent(), 0);
  } catch {
    accountMessage(
      "Account service unavailable. The displayed dataset has not been switched.",
    );
  }
})();
function requireAccountClient() {
  if (!accountClient)
    throw Error("Connected accounts are not configured or unavailable.");
}
function accountSignIn(create) {
  return accountTask(async () => {
    requireAccountClient();
    if (connection.busy) throw Error("Wait for the current operation.");
    const credentials = {
      email: document.getElementById("accountEmail").value.trim(),
      password: document.getElementById("accountPassword").value,
    };
    const result = create
      ? await accountClient.auth.signUp(credentials)
      : await accountClient.auth.signInWithPassword(credentials);
    document.getElementById("accountPassword").value = "";
    if (result.error) throw Error(result.error.message);
    connection.auth(result.data.session);
    accountMessage(
      result.data.session
        ? "Signed in. Choose a dataset or preview an import."
        : "Check your email to confirm the account, then sign in.",
    );
    if (new URLSearchParams(location.search).has("authorization_id"))
      await loadConsent();
  });
}
function accountSignOut() {
  return accountTask(async () => {
    requireAccountClient();
    if (connection.busy) throw Error("Wait for the current operation.");
    const { error } = await accountClient.auth.signOut({ scope: "local" });
    connection.auth(null);
    if (error) throw error;
    accountMessage(
      "Signed out. The displayed dataset was retained. Use local-only GymBro explicitly to change datasets.",
    );
  });
}
function accountUseLocal() {
  return accountTask(async () => {
    if (!confirmDiscardSetInput()) return;
    connection.useLocal();
    clearForm();
    clearInbox();
    renderAll();
    accountMessage("Using the preserved local-only dataset.");
  });
}
function accountUseServer() {
  return accountTask(async () => {
    if (
      !confirmDiscardSetInput() ||
      !confirm(
        "Display this signed-in account’s server dataset? Local-only history will remain separate.",
      )
    )
      return;
    await connection.useServer();
    clearForm();
    clearInbox();
    renderAll();
    accountMessage("Using connected account data.");
  });
}
function accountRefresh() {
  return accountTask(async () => {
    await connection.refresh();
    renderAll();
    accountMessage(
      "Server data checked. Unsaved form input was retained; inspect it before saving.",
    );
  });
}
function accountPreview() {
  return accountTask(async () => {
    await connection.importPreview();
    accountMessage("Review the import before committing.");
  });
}
function canonicalAccountJSON(value) {
  if (Array.isArray(value))
    return "[" + value.map(canonicalAccountJSON).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalAccountJSON(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
async function accountDigest(state) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalAccountJSON(state)),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
function accountCommit() {
  return accountTask(async () => {
    if (
      !confirmDiscardSetInput() ||
      !confirm(
        "Commit exactly this reviewed import, verify it from the server, then use it as the authoritative connected dataset?",
      )
    )
      return;
    await connection.importCommit(accountDigest);
    clearForm();
    clearInbox();
    renderAll();
    accountMessage(
      "Import committed, read back and integrity verified. Connected data is now authoritative.",
    );
  });
}
async function loadConsent() {
  requireAccountClient();
  const authorizationId = new URLSearchParams(location.search).get(
    "authorization_id",
  );
  consentDetails = await connection.api({
    op: "consent-details",
    authorizationId,
  });
  if (!consentDetails.client) {
    accountMessage(
      "Continuing existing Supabase consent. GymBro permissions remain unchanged.",
    );
    if (consentDetails.redirect_url)
      location.assign(consentDetails.redirect_url);
    return;
  }
  document.getElementById("trainerConsent").hidden = false;
  document.getElementById("trainerConsentTitle").textContent =
    "Authorize " + consentDetails.client.name;
  document.getElementById("trainerIdentityScopes").textContent =
    "Client: " +
    consentDetails.client.id +
    " · Identity scopes requested: " +
    consentDetails.scope +
    " · Return address: " +
    consentDetails.redirect_uri;
  for (const id of ["scopeRead", "scopeWrite", "scopeHistory"])
    document.getElementById(id).checked = false;
}
function accountLoadConsent() {
  return accountTask(loadConsent);
}
function accountConsent(allow) {
  return accountTask(async () => {
    if (!consentDetails?.authorization_id)
      throw Error("Open a fresh authorization request.");
    if (!allow) {
      const { data, error } = await accountClient.auth.oauth.denyAuthorization(
        consentDetails.authorization_id,
        { skipBrowserRedirect: true },
      );
      if (error) throw error;
      location.assign(data.redirect_url);
      return;
    }
    const scopes = [];
    if (document.getElementById("scopeRead").checked)
      scopes.push("training:read");
    if (document.getElementById("scopeWrite").checked)
      scopes.push("workout:write");
    const historyConsent = document.getElementById("scopeHistory").checked;
    if (historyConsent) scopes.push("history:modify");
    const result = await connection.api({
      op: "consent",
      authorizationId: consentDetails.authorization_id,
      scopes,
      historyConsent,
    });
    // Respect grant token cutoff; redirect only after the server transaction is durable.
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, result.notBefore * 1000 - Date.now()) + 50,
      ),
    );
    location.assign(result.redirect_url);
  });
}
function accountGrants() {
  return accountTask(async () => {
    const { grants } = await connection.api({ op: "grants" });
    const root = document.getElementById("trainerGrants");
    root.replaceChildren();
    for (const grant of grants) {
      const p = document.createElement("p");
      p.textContent =
        grant.name +
        " · " +
        grant.scopes.join(", ") +
        " · " +
        (grant.revoked_at ? "revoked" : "authorized");
      if (!grant.revoked_at) {
        const button = document.createElement("button");
        button.textContent = "Revoke access";
        button.onclick = () =>
          accountTask(async () => {
            const r = await connection.api({
              op: "revoke",
              clientId: grant.client_id,
            });
            accountMessage(
              r.upstreamRevoked
                ? "Access revoked. Workout data retained."
                : "GymBro access revoked. Supabase identity-grant revocation could not be confirmed; retry revocation.",
            );
            button.disabled = true;
          });
        p.append(button);
      }
      root.append(p);
    }
    if (!grants.length)
      root.textContent = "No trainer applications authorized.";
  });
}

function accountPreviewEmpty() {
  return accountTask(async () => {
    const state = emptyData();
    state.preferences = {};
    await connection.importPreview(state);
    accountMessage(
      "Review an empty connected dataset with default program settings. Local history will remain untouched.",
    );
  });
}
function accountRetry() {
  return accountTask(async () => {
    const result = await connection.retryPending();
    if (!result.ok) throw Error(result.errors.join("\n"));
    renderAll();
    accountMessage(
      "Pending save resolved. Inspect the saved result before entering another set.",
    );
  });
}
