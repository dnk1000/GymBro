// Optional local server for the same public configuration route used by Vercel.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const config = require("../api/supabase-probe-config.js");
const root = path.resolve(__dirname, "..");
function createServer() {
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/api/supabase-probe-config") {
      res.status = code => { res.statusCode = code; return res; };
      res.json = body => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
      return config(req, res);
    }
    try {
      if (!["GET", "HEAD"].includes(req.method)) throw Error("method");
      const relative = decodeURIComponent(pathname === "/" ? "/index.html" : pathname).slice(1);
      const file = path.resolve(root, relative);
      const parts = relative.split(/[\\/]/);
      if (!file.startsWith(root + path.sep) || parts.some(part => part.startsWith(".")) ||
          (parts.length > 1 && !(parts.length === 2 && parts[0] === "vendor")) ||
          !/\.(?:html|js|css|png)$/.test(relative)) throw Error("path");
      const data = await fs.readFile(file);
      const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" }[path.extname(file)];
      res.setHeader("Content-Type", type);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404); res.end("Not found");
    }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, "127.0.0.1", () => console.log(`GymBro: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
