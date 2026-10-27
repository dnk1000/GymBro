// Local development adapter for the same static app and public config functions.
const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const routes = {
  "/api/config": require("../api/config.js"),
  "/api/supabase-sdk": require("../api/supabase-sdk.js"),
};
const server = http
  .createServer(async (req, res) => {
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (v) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(v));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (routes[url.pathname]) return routes[url.pathname](req, res);
      const name =
        url.pathname === "/"
          ? "index.html"
          : decodeURIComponent(url.pathname.slice(1));
      if (
        !/^(?:[\w-]+\.(?:html|js|css|png)|tests\/fixtures\/[\w-]+\.json)$/.test(
          name,
        )
      )
        return res.status(404).end();
      const data = await fs.readFile(path.join(root, name));
      res.setHeader(
        "Content-Type",
        name.endsWith(".js")
          ? "text/javascript"
          : name.endsWith(".css")
            ? "text/css"
            : name.endsWith(".png")
              ? "image/png"
              : "text/html",
      );
      res.end(data);
    } catch {
      res.status(404).end();
    }
  })
  .listen(Number(process.env.PORT || 8000), "127.0.0.1", () =>
    console.log(`GymBro ready http://127.0.0.1:${server.address().port}`),
  );
