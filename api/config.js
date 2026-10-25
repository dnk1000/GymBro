const { stagingConfig } = require("../server/config.cjs");
module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();
  try {
    const { url, key } = stagingConfig();
    return res.status(200).json({ enabled: true, url, key });
  } catch {
    return res.status(200).json({ enabled: false });
  }
};
