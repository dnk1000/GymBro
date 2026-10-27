const environments = require("../../supabase/environments.json");

// Project IDs are public deployment boundaries, never credentials.
function previewEnvironment(env) {
  const expected = environments.preview.projectRef;
  if (expected === environments.production.projectRef ||
      env.GYMBRO_CLOUD_ENV !== "preview" || env.SUPABASE_PROJECT_REF !== expected)
    return { ok: false, message: "Set Preview-only GYMBRO_CLOUD_ENV and SUPABASE_PROJECT_REF to the approved Preview environment." };
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch {}
  if (!url || url.href !== `https://${expected}.supabase.co/`)
    return { ok: false, message: "SUPABASE_URL must match the approved Preview project; Production and unknown projects are refused." };
  return { ok: true, projectRef: expected, url: url.origin };
}

module.exports = { environments, previewEnvironment };
