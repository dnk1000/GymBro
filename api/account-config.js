const { probeConfig } = require("./supabase-probe-config.js");
const { productionCloudConfig } = require("./_lib/supabase-environment.cjs");
function accountConfig(env, host) {
  const production = productionCloudConfig(env, host);
  if (production) return production;
  if (env.GYMBRO_ACCOUNT_ACCESS !== "true") return { enabled: false };
  // Reuse #38's project/key guards, independently of the diagnostic flag.
  return probeConfig({ ...env, GYMBRO_SUPABASE_PROBE: "true" });
}
function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json(accountConfig(process.env, req.headers.host));
}
module.exports = handler;
module.exports.accountConfig = accountConfig;
