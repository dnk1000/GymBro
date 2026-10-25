const fs = require("node:fs");
const path = require("node:path");
module.exports = (_req, res) => {
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
