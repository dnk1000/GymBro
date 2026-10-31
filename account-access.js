// Account state is independent of the local workout database. No workout imports.
(() => {
  const el = id => document.getElementById(id);
  const card = el("accountAccess"), status = el("accountStatus");
  const email = el("accountEmail");
  const callbackError = /(?:^#|&)error=/.test(location.hash);
  const callbackSession = /(?:^#|&)access_token=/.test(location.hash);
  let client, config, initializing, busy = false, user = null, generation = 0, refreshPending = false;
  const support=OperationalDiagnostics.mount(card,{operation:'account',mode:typeof cloudMode!=='undefined'&&cloudMode?'cloud':'local'});

  async function timedFetch(url, options = {}) {
    if (config?.rehearsal) await CutoverRehearsal.beforeFetch(config,url,options);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch(error) { if(controller.signal.aborted)throw OperationalDiagnostics.failure("TIMEOUT","Account request timed out.");throw error; }
    finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
  }
  function controls() {
    for (const control of card.querySelectorAll("input, button")) control.disabled = busy;
    el("accountSignIn").hidden = !!user;
    el("accountSignedIn").hidden = !user;
    el("accountIdentity").textContent = user ? `Signed in as ${user.email}` : "Signed out";
  }
  function invalidate() {
    generation++;
    user = null;
    window.dispatchEvent(new CustomEvent("gymbro-account",{detail:null}));
    el("accountCheckResult").textContent = "";
    controls();
  }
  async function verifiedUser() {
    const { data, error } = await client.auth.getUser();
    if (error) {window.dispatchEvent(new Event("gymbro-account-unavailable"));throw OperationalDiagnostics.transport(error);}
    if (!data.user?.id || data.user.is_anonymous || !data.user.email) {window.dispatchEvent(new Event("gymbro-account-unavailable"));throw OperationalDiagnostics.failure("AUTH","Identity could not be verified.");}
    return data.user;
  }
  async function restore() {
    const { data, error } = await client.auth.getSession();
    if (error) {window.dispatchEvent(new Event("gymbro-account-unavailable"));throw error;}
    if (!data.session) { invalidate(); return; }
    const revision = generation;
    const next = await verifiedUser();
    if (revision === generation) { user = next; window.dispatchEvent(new CustomEvent("gymbro-account",{detail:{user,client,config}})); }
  }
  function message(error) {
    const code = (()=>{try{return Object.getOwnPropertyDescriptor(error,"code")?.value;}catch{return null;}})();
    if (code === "logout_unconfirmed")
      return "Signed out locally, but server session revocation could not be confirmed. Check your connection and request a fresh link before using this account again.";
    if (OperationalDiagnostics.classify(error) === "RATE_LIMIT")
      return "Too many requests. Wait before requesting another sign-in link.";
    return support.update({error,config});
  }
  async function run(action) {
    if (busy || !client) return;
    busy = true; controls();
    status.textContent = "Working…";
    try {
      await action();
    } catch (error) { status.textContent = message(error); }
    finally {
      busy = false; controls();
      if (refreshPending) { refreshPending = false; setTimeout(refresh, 0); }
    }
  }
  function refresh() {
    if (busy) { refreshPending = true; return; }
    return run(async () => {
      await restore(); status.textContent = restoredMessage();
    });
  }
  function restoredMessage() {
    return user ? "Account restored." : callbackError ? "That sign-in link is invalid or expired. Request a fresh link." : callbackSession ? "Sign-in could not be verified. Check your connection, then refresh account or request a fresh link." : "Request an email link to sign in or recover access.";
  }
  async function initialize() {
    if (initializing || !/^https?:$/.test(location.protocol)) return;
    initializing = true;
    try {
      const rehearsal=CutoverRehearsal.active();
      const response = rehearsal ? null : await timedFetch("/api/account-config", { cache: "no-store" });
      if(rehearsal) config=await CutoverRehearsal.configuration();
      else {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      config = await response.json();
      }
      support.update({config});
      if (!config.enabled) return;
      card.hidden = false;
      if (!config.configured) { status.textContent = support.update({config,error:OperationalDiagnostics.failure("CONFIGURATION","Account configuration unavailable.")}); return; }
      el("accountEnvironment").textContent = config.rehearsal ? `Production rehearsal · ${config.projectRef} · ${config.build} · ${config.deploymentUrl}` : `Preview accounts · ${config.projectRef} · separate from Production`;
      el("accountCheck").hidden=!!config.rehearsal;
      if (!window.supabase?.createClient) await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const timer = setTimeout(() => script.onerror(), 15000);
        script.src = "vendor/supabase-2.118.0.js";
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); script.remove(); reject(Error("sdk")); };
        document.head.append(script);
      });
      client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { storageKey: `gymbro-account-auth-${config.projectRef}`,
          persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: { fetch: timedFetch },
      });
      client.auth.onAuthStateChange((event, session) => {
        // Never await Auth calls while the SDK holds its auth-state lock.
        if (["SIGNED_OUT", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)) {
          if (event !== "SIGNED_OUT" && user?.id === session?.user?.id) return;
          invalidate();
          if (event === "SIGNED_OUT") {
            status.textContent = "Signed out of this browser. Use a new email link to recover access.";
          } else setTimeout(refresh, 0);
        }
      });
      await run(async () => {
        await restore(); status.textContent = restoredMessage();
      });
    } catch (error) { status.textContent = "Account access could not load. Reopen Data to retry. "+support.update({error,config}); }
    finally { initializing = !!client; }
  }
  el("accountRequest").addEventListener("click", () => {
    if (!email.reportValidity() || !email.value.trim()) return;
    run(async () => {
      const { error } = await client.auth.signInWithOtp({ email: email.value.trim(), options: {
        shouldCreateUser: !config.rehearsal, emailRedirectTo: new URL(config.rehearsal?"/?storage=cloud&rehearsal=production":"/", location.href).href,
      } });
      if (error) throw error;
      status.textContent = "Check your email and open the sign-in link. Wait at least 60 seconds before requesting another.";
    });
  });
  el("accountSignOut").addEventListener("click", () => run(async () => {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) {
      // The pinned SDK clears local credentials even for some server failures.
      const current = await client.auth.getSession();
      if (!current.data.session) { invalidate(); throw { code: "logout_unconfirmed" }; }
      throw error;
    }
    invalidate();
    status.textContent = "Signed out of this browser. Use a new email link to recover access.";
  }));
  el("accountRefresh").addEventListener("click", () => run(async () => {
    await restore(); status.textContent = user ? "Account restored." : "Signed out. Request a new link.";
  }));
  el("accountCheck").addEventListener("click", () => run(async () => {
    el("accountCheckResult").textContent = "";
    const revision = generation, owner = await verifiedUser();
    const { error } = await client.from("gymbro_private_access").upsert({ owner_id: owner.id, value: "Account access verified" });
    if (error) throw error;
    const result = await client.from("gymbro_private_access").select("value").eq("owner_id", owner.id).single();
    if (result.error) throw result.error;
    if (revision !== generation) throw Error("identity_changed");
    el("accountCheckResult").textContent = result.data.value;
    status.textContent = "Private access check saved and read from Preview. No workouts uploaded.";
  }));
  document.querySelector('[data-view="data"]').addEventListener("click", initialize);
  window.addEventListener("hashchange", () => {
    if (/(?:^#|&)access_token=|(?:^#|&)error=/.test(location.hash)) location.reload();
  });
  // The default Supabase email link returns an implicit session in the fragment.
  // Let the pinned SDK validate/store it and remove it from the URL immediately.
  if (/(?:^#|&)access_token=|(?:^#|&)error=/.test(location.hash)) {
    document.querySelector('[data-view="data"]').click();
  }
})();
