const { Store, poolFromEnvironment } = require("../server/store.cjs");
const { Service } = require("../server/service.cjs");
const { authenticator, oauth } = require("../server/auth.cjs");
const { stagingConfig } = require("../server/config.cjs");
let runtime;
function getRuntime() {
  if (!runtime) {
    const config = stagingConfig();
    if (!config.url || !config.key || !process.env.DATABASE_URL)
      throw Object.assign(Error("Connected accounts are not configured."), {
        status: 503,
        code: "NOT_CONFIGURED",
      });
    runtime = {
      authenticate: authenticator(config),
      service: new Service(new Store(poolFromEnvironment()), {
        oauth: (...args) => oauth(config, ...args),
      }),
    };
  }
  return runtime;
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST")
      return res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
    if (req.headers.origin && req.headers.origin !== process.env.GYMBRO_ORIGIN)
      return res.status(403).json({ code: "ORIGIN_DENIED" });
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
      return res.status(415).json({ code: "JSON_REQUIRED" });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(body) || "") > 1000000)
      return res.status(413).json({ code: "PAYLOAD_TOO_LARGE" });
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || "");
    if (!match)
      return res
        .status(401)
        .json({ code: "UNAUTHENTICATED", message: "Sign in required." });
    const { authenticate, service } = getRuntime();
    const auth = await authenticate(match[1]);
    return res.status(200).json(await service.execute(auth, body));
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({
        code: e.code || "SERVER_ERROR",
        message: e.status
          ? e.message
          : "The request could not be completed. Reconcile before retrying a write.",
      });
  }
}
module.exports = handler;
module.exports.getRuntime = getRuntime;
