// Local Vercel-compatible HTTP adapter, loopback only; never logs auth headers/bodies.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const routes = {
  "/api/gymbro": require("../api/gymbro.js"),
  "/api/config": require("../api/config.js"),
  "/api/sdk": require("../api/sdk.js"),
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    if (routes[url.pathname]) {
      let data = "";
      for await (const part of req) {
        data += part;
        if (Buffer.byteLength(data) > 1000000) {
          res.status(413).end();
          return;
        }
      }
      req.body = data || undefined;
      await routes[url.pathname](req, res);
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      !/^\/(?:index\.html|[\w-]+\.(?:js|css|png)|tests\/fixtures\/[\w-]+\.json)$/.test(
        pathname === "/" ? "/index.html" : pathname,
      )
    ) {
      res.status(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".png")
            ? "image/png"
            : "text/html",
    );
    res.end(await fs.promises.readFile(file));
  } catch {
    res.statusCode = 500;
    res.end("Request failed");
  }
});
server.listen(Number(process.env.PORT || 8000), "127.0.0.1", () =>
  console.log("GymBro development server ready"),
);
