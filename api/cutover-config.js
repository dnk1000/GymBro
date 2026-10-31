// Phase 1 only. No Production permission follows from a branch or design approval.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { createHash } = require('node:crypto');
const { environments } = require('./_lib/supabase-environment.cjs');
const branch = 'codex/issue-84-production-readiness';
const approvalUrl = 'https://api.github.com/repos/dnk1000/GymBro/issues/84';
const marker = '<!-- gymbro-cutover-approval-v1 -->';
const endMarker = '<!-- /gymbro-cutover-approval-v1 -->';
const actions = ['read','initializeMigration','restoreCompleteBackup','mergeHistoryBackup','logSet','editSet','deleteSet',
  'logBodyweight','createSession','completeSession','attachSetToSession','selectPlan','clearPlan','toggleSlotShort',
  'cycleSlotRole','removeSlot','addSlot','commitImport','saveScopedNote','startGuidedSession','enableGuidance',
  'selectGuidedSlot','moveGuidedSlot','setGuidedSlotStatus','substituteGuidedExercise','logGuidedSet','finishGuidedSession'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function buildVersion() {
  return runInNewContext(readFileSync(join(__dirname,'..','app-version.js'),'utf8')+'\nAPP_VERSION.version',{}, {timeout:1000});
}
function parseApproval(body) {
  if (typeof body !== 'string' || body.split(marker).length !== 2 || body.split(endMarker).length !== 2) throw Error('approval');
  return JSON.parse(body.split(marker)[1].split(endMarker)[0]);
}
function validateApproval(approval, env, host, build, now = Date.now()) {
  const ref = environments.production.projectRef;
  if (!approval || approval.version !== 1 || approval.issue !== 84 || approval.enabled !== true ||
      !['synthetic','personal'].includes(approval.mode) || approval.projectRef !== ref || approval.branch !== branch ||
      env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== branch ||
      env.GYMBRO_CLOUD_ENV !== 'production-rehearsal' || env.SUPABASE_PROJECT_REF !== ref ||
      env.SUPABASE_URL !== `https://${ref}.supabase.co` ||
      !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(env.SUPABASE_PUBLISHABLE_KEY ?? '') ||
      !/^[a-f0-9]{40}$/.test(approval.gitSha ?? '') || approval.gitSha !== env.VERCEL_GIT_COMMIT_SHA ||
      approval.build !== build || !/^\d+\.\d+\.\d+-\d{8}T\d{6}Z$/.test(build) ||
      !env.VERCEL_URL || !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL) ||
      host !== env.VERCEL_URL || approval.deploymentUrl !== `https://${env.VERCEL_URL}` ||
      !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= now ||
      !Array.isArray(approval.allowedOwners) || approval.allowedOwners.length < 1 || approval.allowedOwners.length > 4 ||
      !approval.allowedOwners.every(id => uuid.test(id)) || new Set(approval.allowedOwners).size !== approval.allowedOwners.length ||
      !Array.isArray(approval.actions) || !approval.actions.includes('read') || !approval.actions.every(a => actions.includes(a)) ||
      (approval.mode === 'personal' && (approval.allowedOwners.length !== 1 || !/^[a-f0-9]{64}$/.test(approval.sourceByteDigest ?? ''))) ||
      (approval.mode === 'synthetic' && !/^gymbro-issue84-[a-z0-9-]+$/.test(approval.fixtureTag ?? '')))
    throw Error('approval');
  return {enabled:true,configured:true,rehearsal:true,environment:'production-rehearsal',projectRef:ref,
    url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,allowedOwners:approval.allowedOwners,
    syntheticOnly:approval.mode === 'synthetic',fixtureTag:approval.mode === 'synthetic' ? approval.fixtureTag : null,
    sourceByteDigest:approval.mode === 'personal' ? approval.sourceByteDigest : null,actions:approval.actions,
    deploymentUrl:approval.deploymentUrl,gitSha:approval.gitSha,build,expiresAt:approval.expiresAt,
    approvalDigest:createHash('sha256').update(JSON.stringify(approval)).digest('hex')};
}
async function cutoverConfig(env, host, {fetcher = fetch, now = Date.now(), build} = {}) {
  if (env.GYMBRO_CUTOVER_REHEARSAL !== 'true') return {enabled:false};
  try {
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== branch || host !== env.VERCEL_URL) throw Error('boundary');
    const response = await fetcher(approvalUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Accept:'application/vnd.github+json','User-Agent':'GymBro-Phase1-readiness'}});
    if (!response.ok) throw Error('approval');
    const issue = await response.json();
    if (issue.number !== 84 || issue.state !== 'open') throw Error('approval');
    return validateApproval(parseApproval(issue.body),env,host,build??buildVersion(),now);
  } catch {
    return {enabled:true,configured:false,message:'Production rehearsal is not authorized for this exact deployment/source. No cloud access is enabled.'};
  }
}
async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json(await cutoverConfig(process.env,req.headers.host));
}
module.exports = handler;
Object.assign(module.exports,{cutoverConfig,validateApproval,parseApproval,approvalUrl,marker,endMarker,actions});
