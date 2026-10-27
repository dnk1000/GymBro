// Only this public configuration crosses the server/browser boundary.
const { previewEnvironment } = require("./_lib/supabase-environment.cjs");
function probeConfig(env) {
  const preview = env.VERCEL_ENV === "preview";
  const local = !env.VERCEL && !env.VERCEL_ENV && env.GYMBRO_PROBE_LOCAL === "true";
  if ((!preview && !local) || env.GYMBRO_SUPABASE_PROBE !== "true")
    return { enabled: false };
  const environment = preview ? "preview" : "local";
  const boundary = previewEnvironment(env);
  if (!boundary.ok) return { enabled: true, configured: false, environment,
    message: boundary.message };
  const url = boundary.url;
  const key = env.SUPABASE_PUBLISHABLE_KEY || "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {}
  if (
    !parsed || parsed.protocol !== "https:" ||
    !/^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname) ||
    parsed.username || parsed.password || parsed.port ||
    parsed.search || parsed.hash || parsed.pathname !== "/"
  ) return { enabled: true, configured: false, environment,
    message: "Set SUPABASE_URL to the intended https://<project-ref>.supabase.co project URL." };
  // Deliberately refuse legacy JWTs and secret/service-role keys.
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key))
    return { enabled: true, configured: false, environment,
      message: "Set SUPABASE_PUBLISHABLE_KEY to this project's sb_publishable_ key." };
  return { enabled: true, configured: true, environment,
    projectRef: parsed.hostname.split(".")[0], url: parsed.origin,
    publishableKey: key };
}

function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json(probeConfig(process.env));
}
module.exports = handler;
module.exports.probeConfig = probeConfig;
