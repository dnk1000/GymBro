// Optional diagnostic only. Never reads or writes GymBro's workout database.
(() => {
  const card = document.getElementById("supabaseProbe");
  const status = document.getElementById("probeStatus");
  const details = document.getElementById("probeDetails");
  const identity = document.getElementById("probeIdentity");
  const input = document.getElementById("probeValue");
  const result = document.getElementById("probeResult");
  const save = document.getElementById("probeSave");
  const read = document.getElementById("probeRead");
  let config, client, sdkLoad, busy = false;

  async function timedFetch(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  async function initialize() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const response = await timedFetch("/api/supabase-probe-config", { cache: "no-store" }, 10000);
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      config = await response.json();
      if (!config.enabled) return;
      card.hidden = false;
      if (!config.configured) {
        status.textContent = "Not configured. " + config.message;
        return;
      }
      details.textContent = `${config.environment === "preview" ? "Vercel Preview" : "Local test"} · Project: ${config.projectRef}`;
      status.textContent = "Configured. Save or read a test value to check the live connection.";
      save.disabled = read.disabled = false;
    } catch {
      // Static/unconfigured GymBro remains independent of this optional endpoint.
    }
  }

  function loadSDK() {
    if (window.supabase?.createClient) return Promise.resolve();
    if (!sdkLoad) sdkLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => script.onerror(), 15000);
      script.src = "vendor/supabase-2.118.0.js";
      script.onload = () => {
        clearTimeout(timer);
        if (window.supabase?.createClient) resolve();
        else { sdkLoad = null; reject(Error("sdk")); }
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        sdkLoad = null;
        reject(Error("sdk"));
      };
      document.head.append(script);
    });
    return sdkLoad;
  }

  async function testUser() {
    await loadSDK();
    if (!client) client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        storageKey: `gymbro-probe-auth-${config.projectRef}`,
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      },
      global: { fetch: timedFetch },
    });
    let { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const signedIn = await client.auth.signInAnonymously();
      if (signedIn.error) throw signedIn.error;
    }
    const verified = await client.auth.getUser();
    if (verified.error) throw verified.error;
    if (!verified.data.user?.id) throw Error("identity");
    identity.textContent = `Test identity: ${verified.data.user.id}`;
    return verified.data.user.id;
  }

  function errorText(error) {
    const code = error.code;
    if (error.message === "sdk") return "The test client could not load. Reload the page and try again.";
    if (code === "anonymous_provider_disabled") return "Enable anonymous sign-ins in the intended Supabase project's Authentication settings.";
    if (code === "over_request_rate_limit" || error.status === 429) return "Supabase rate limit reached. Wait before trying again; keep using the same browser identity.";
    if (code === "PGRST205" || code === "42P01") return "The diagnostic table is unavailable. Run the supplied setup SQL and check Data API access.";
    if (code === "42501") return "Supabase denied access. Check the diagnostic table's grants and owner-only RLS policies.";
    return "The Supabase request failed. Check the project/key pair, anonymous sign-ins, network, and diagnostic table permissions. No workout data was changed.";
  }

  async function run(action) {
    if (busy || !config?.configured) return;
    const value = input.value;
    if (action === "save" && (!value.trim() || value.length > 120)) {
      status.textContent = "Enter a nonblank test value of at most 120 characters.";
      return;
    }
    busy = true;
    input.disabled = true;
    save.disabled = read.disabled = true;
    result.textContent = "";
    status.textContent = action === "save" ? "Saving test value…" : "Reading from Supabase…";
    try {
      const owner = await testUser();
      if (action === "save") {
        const { error } = await client.from("gymbro_connection_probe")
          .upsert({ owner_id: owner, value }, { onConflict: "owner_id" });
        if (error) throw error;
        status.textContent = "Saved in Supabase. Click Read test value to retrieve it.";
      } else {
        const { data, error } = await client.from("gymbro_connection_probe")
          .select("value").eq("owner_id", owner).maybeSingle();
        if (error) throw error;
        if (!data) status.textContent = "No test value saved for this browser identity.";
        else {
          if (typeof data.value !== "string") throw Error("response");
          result.textContent = data.value;
          status.textContent = "Read succeeded. The value below came from Supabase.";
        }
      }
    } catch (error) {
      status.textContent = errorText(error);
    } finally {
      busy = false;
      input.disabled = false;
      save.disabled = read.disabled = false;
    }
  }

  document.querySelector('[data-view="data"]').addEventListener("click", initialize, { once: true });
  save.addEventListener("click", () => run("save"));
  read.addEventListener("click", () => run("read"));
})();
