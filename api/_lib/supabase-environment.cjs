const environments = require("../../supabase/environments.json");
const productionOrigin = require("../../cloud-authority.js");

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

function productionCloudConfig(env, host) {
  if (env.VERCEL_ENV !== "production") return null;
  if (env.GYMBRO_PRODUCTION_WORKOUTS !== "true") return { enabled: false };
  const projectRef = environments.production.projectRef;
  const url = `https://${projectRef}.supabase.co`;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const allowedOwners = (env.GYMBRO_PRODUCTION_WORKOUT_OWNERS ?? "").split(",");
  if (env.VERCEL !== "1" || host !== new URL(productionOrigin).host ||
      env.GYMBRO_CLOUD_ENV !== "production" || env.SUPABASE_PROJECT_REF !== projectRef ||
      ![url, url + "/"].includes(env.SUPABASE_URL) ||
      !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey ?? "") ||
      !allowedOwners.every(id => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) ||
      new Set(allowedOwners).size !== allowedOwners.length)
    return { enabled: true, configured: false, environment: "production" };
  return { enabled: true, configured: true, environment: "production",
    projectRef, url, publishableKey, allowedOwners };
}

module.exports = { environments, previewEnvironment, productionCloudConfig };
