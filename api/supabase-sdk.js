const fs = require("node:fs"),
  path = require("node:path");
module.exports = (req, res) => {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public,max-age=3600");
  res.end(
    fs.readFileSync(
      path.join(
        path.dirname(require.resolve("@supabase/supabase-js")),
        "umd/supabase.js",
      ),
    ),
  );
};
