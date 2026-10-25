const { createClient } = require("@supabase/supabase-js");
const { error } = require("../contracts/permissions.cjs");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateClaims(c, user, url, now = Math.floor(Date.now() / 1000)) {
  if (
    !c ||
    c.iss !== url.replace(/\/$/, "") + "/auth/v1" ||
    c.aud !== "authenticated" ||
    c.role !== "authenticated" ||
    !Number.isFinite(c.exp) ||
    c.exp <= now ||
    !Number.isFinite(c.iat) ||
    c.iat > now + 30 ||
    !UUID.test(c.sub) ||
    !UUID.test(c.session_id) ||
    c.sub !== user?.id ||
    (Object.hasOwn(c, "client_id") && !UUID.test(c.client_id))
  )
    throw error("UNAUTHENTICATED", "Invalid or expired session.", 401);
  return {
    userId: c.sub,
    email: user.email,
    clientId: c.client_id || null,
    issuedAt: c.iat,
  };
}
function authenticator(config) {
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return async (token) => {
    if (typeof token !== "string" || token.length > 16000)
      throw error("UNAUTHENTICATED", "Sign in required.", 401);
    const { data, error: claimError } = await client.auth.getClaims(token);
    if (claimError)
      throw error("UNAUTHENTICATED", "Invalid or expired session.", 401);
    const { data: user, error: userError } = await client.auth.getUser(token);
    if (userError) throw error("UNAUTHENTICATED", "Invalid session.", 401);
    return { ...validateClaims(data?.claims, user?.user, config.url), token };
  };
}
// Supabase's OAuth server owns protocol state, redirects, PKCE and token issuance.
async function oauth(config, auth, path, method = "GET", body) {
  const response = await fetch(config.url + "/auth/v1/" + path, {
    signal: AbortSignal.timeout(10000),
    method,
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + auth.token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw error(
      "AUTH_PROVIDER_ERROR",
      "Supabase could not complete this authorization operation.",
      502,
    );
  return response.status === 204 ? {} : response.json();
}
module.exports = { authenticator, validateClaims, oauth, UUID };
