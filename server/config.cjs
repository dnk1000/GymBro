function stagingConfig(env = process.env) {
  const {
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: key,
    DATABASE_URL: databaseUrl,
    GYMBRO_ORIGIN: origin,
    GYMBRO_SUPABASE_PROJECT_REF: ref,
    GYMBRO_DEPLOY_TARGET: target,
  } = env;
  if (
    target !== "v3-staging" ||
    !url ||
    !key ||
    !databaseUrl ||
    !origin ||
    !ref
  )
    throw Object.assign(Error("V3 staging is not explicitly configured."), {
      status: 503,
      code: "NOT_CONFIGURED",
    });
  if (!key.startsWith("sb_publishable_"))
    throw Error(
      "Use the Supabase publishable key, never a secret or service-role key.",
    );
  const authURL = new URL(url),
    dbURL = new URL(databaseUrl),
    appURL = new URL(origin);
  if (
    authURL.protocol !== "https:" ||
    authURL.hostname !== ref + ".supabase.co" ||
    authURL.pathname !== "/" ||
    authURL.search ||
    authURL.hash ||
    authURL.username ||
    authURL.password
  )
    throw Error(
      "Supabase project does not match the explicit staging project reference.",
    );
  if (
    appURL.origin !== origin ||
    (!["https:"].includes(appURL.protocol) &&
      !["127.0.0.1", "localhost"].includes(appURL.hostname))
  )
    throw Error("Invalid staging application origin.");
  const direct = dbURL.hostname === "db." + ref + ".supabase.co";
  const pooler =
    dbURL.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(dbURL.username).endsWith("." + ref);
  if (!direct && !pooler)
    throw Error(
      "Database destination does not match the explicit staging project reference.",
    );
  return { url: authURL.origin, key, origin };
}
module.exports = { stagingConfig };
