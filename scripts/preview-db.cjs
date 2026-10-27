// Operator tooling only. Never imported by the app or invoked by a Vercel build.
const { execFileSync, spawnSync } = require("node:child_process");
const path = require("node:path");
const { environments, previewEnvironment } = require("../api/_lib/supabase-environment.cjs");
const root = path.resolve(__dirname, "..");

function commandsFor(action, env, revision) {
  if (!["plan", "apply", "list", "verify"].includes(action))
    throw Error("Usage: npm run db:preview -- plan|apply|list|verify");
  const boundary = previewEnvironment(env);
  if (!boundary.ok) throw Error(boundary.message);
  if (env.VERCEL || env.VERCEL_ENV || env.CI)
    throw Error("Hosted migrations require an explicit operator session; app builds and automatic CI cannot apply them.");
  const target = ["--project-ref", environments.preview.projectRef];
  const plan = ["db", "push", ...target, "--skip-vault", "--dry-run"];
  if (action === "plan") return [plan];
  if (action === "list") return [["migration", "list", ...target]];
  if (action === "verify") return [["db", "query", "--linked", ...target, "--file", "supabase/verify-infrastructure.sql"]];
  if (!/^[a-f0-9]{40}$/.test(revision) || env.GYMBRO_DB_APPLY_REVISION !== revision)
    throw Error("Apply requires GYMBRO_DB_APPLY_REVISION equal to the reviewed full HEAD SHA.");
  return [plan, ["db", "push", ...target, "--skip-vault", "--yes"]];
}

function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1) throw Error("Provide exactly one action; arbitrary CLI flags are not supported.");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const commands = commandsFor(argv[0], env, revision);
  if (argv[0] === "apply" && execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"],
    { cwd: root, encoding: "utf8" }).trim()) throw Error("Commit the reviewed changes before applying Preview migrations.");
  // Resolve the npm-installed executable without a shell or arbitrary argument interpolation.
  const executable = require.resolve("supabase/dist/supabase.js");
  console.log(`Preview ${environments.preview.projectRef}; revision ${revision}; action ${argv[0]}.`);
  for (const args of commands) {
    const result = spawnSync(process.execPath, [executable, ...args], { cwd: root, env, encoding: "utf8" });
    // The CLI may include connection details in an error. Never echo those details.
    if (result.error || result.status !== 0) throw Error("Supabase command failed. Check authentication, project access and database availability privately; no success is claimed.");
    let output = result.stdout + result.stderr;
    for (const [key, value] of Object.entries(env))
      if (value && /TOKEN|PASSWORD|SECRET|KEY|DATABASE_URL/.test(key)) output = output.split(value).join("[redacted]");
    process.stdout.write(output);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { commandsFor };
