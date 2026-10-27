// Only public browser configuration. Never return a database password or secret key.
module.exports = function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url && !key) return res.status(200).json({ enabled: false });
  try {
    const u = new URL(url);
    if (
      u.protocol !== "https:" ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      u.username ||
      u.password ||
      !u.hostname.endsWith(".supabase.co") ||
      !key?.startsWith("sb_publishable_")
    )
      throw Error();
    return res.status(200).json({ enabled: true, url: u.origin, key });
  } catch {
    return res
      .status(503)
      .json({
        enabled: true,
        error:
          "Supabase URL/publishable key configuration is incomplete or invalid.",
      });
  }
};
