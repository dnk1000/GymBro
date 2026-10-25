const { Pool } = require("pg");
const { error } = require("../contracts/permissions.cjs");
function poolFromEnvironment() {
  const url = new URL(process.env.DATABASE_URL);
  const local =
    process.env.GYMBRO_DB_LOCAL_TEST === "1" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!local && [...url.searchParams.keys()].some((k) => k.startsWith("ssl")))
    throw Error(
      "Configure verified TLS through DATABASE_CA_FILE, not URL SSL overrides.",
    );
  return new Pool({
    connectionString: url.toString(),
    max: 3,
    connectionTimeoutMillis: 10000,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_CA_FILE
            ? {
                ca: require("node:fs").readFileSync(
                  process.env.DATABASE_CA_FILE,
                  "utf8",
                ),
              }
            : {}),
        },
  });
}
class Store {
  constructor(pool) {
    this.pool = pool;
  }
  async transaction(auth, fn) {
    const c = await this.pool.connect();
    let completed = false;
    try {
      await c.query("BEGIN");
      const {
        rows: [role],
      } = await c.query(
        "SELECT bool_or(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb) AS unsafe FROM pg_roles WHERE rolname IN (session_user, 'gymbro_api')",
      );
      if (role.unsafe !== false)
        throw error(
          "UNSAFE_DATABASE_ROLE",
          "API database login must not bypass RLS.",
          503,
        );
      const ownership = await c.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='gymbro' AND r.rolname IN (session_user,'gymbro_api') LIMIT 1",
      );
      if (ownership.rowCount)
        throw error(
          "UNSAFE_DATABASE_ROLE",
          "API roles must not own workout tables.",
          503,
        );
      await c.query("SET LOCAL ROLE gymbro_api");
      await c.query("SELECT set_config('gymbro.user_id',$1,true)", [
        auth.userId,
      ]);
      await c.query("SET LOCAL statement_timeout='10s'");
      if (!auth.clientId)
        await c.query(
          "INSERT INTO gymbro.accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
          [auth.userId],
        );
      const {
        rows: [account],
      } = await c.query(
        "SELECT * FROM gymbro.accounts WHERE user_id=$1 FOR UPDATE",
        [auth.userId],
      );
      if (!account)
        throw error("IMPORT_REQUIRED", "Connect a GymBro dataset first.", 409);
      account.revision = Number(account.revision);
      const tx = {
        c,
        account,
        commit: async () => {
          await c.query("COMMIT");
          completed = true;
        },
      };
      const result = await fn(tx);
      if (!completed) await tx.commit();
      return result;
    } catch (e) {
      if (!completed) await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
}
module.exports = { Store, poolFromEnvironment };
