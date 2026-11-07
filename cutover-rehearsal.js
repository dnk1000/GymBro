// Explicit Phase 1 opt-in. Does not select normal Production workout authority.
const CutoverRehearsal = (() => {
  const active = () => new URLSearchParams(location.search).get('storage') === 'cloud' &&
    new URLSearchParams(location.search).get('rehearsal') === 'production';
  function refuse() {
    window.dispatchEvent(new Event('gymbro-rehearsal-unavailable'));
    throw OperationalDiagnostics.failure('CONFIGURATION','Production rehearsal authorization could not be verified. Saved data and unsaved inputs are retained.');
  }
  async function configuration() {
    try {
      const response = await fetch('/api/cutover-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!response.ok) return refuse();
      const config = await response.json();
      if (!active() || !config.enabled || !config.configured || !config.rehearsal ||
          config.deploymentUrl !== location.origin || config.build !== APP_VERSION.version ||
          !/^[a-f0-9]{40}$/.test(config.gitSha ?? '') || !Number.isFinite(Date.parse(config.expiresAt)) || Date.parse(config.expiresAt) <= Date.now()) return refuse();
      return config;
    } catch { return refuse(); }
  }
  async function verify(config) {
    const current = await configuration();
    if (current.approvalDigest !== config.approvalDigest || current.gitSha !== config.gitSha ||
        current.deploymentUrl !== config.deploymentUrl || current.build !== config.build ||
        current.projectRef !== config.projectRef || current.url !== config.url) return refuse();
    return current;
  }
  async function beforeFetch(config, resource, options = {}) {
    if (!config?.rehearsal) return;
    const current = await verify(config);
    const url = new URL(typeof resource === 'string' || resource instanceof URL ? resource : resource.url);
    if (url.origin !== current.url) return refuse();
    if (url.pathname.startsWith('/auth/v1/')) return;
    const rpc = url.pathname.split('/rest/v1/rpc/')[1];
    if (!['gymbro_lifecycle_snapshot','gymbro_lifecycle_mutate','gymbro_lifecycle_resolve',
      'gymbro_workout_mutate','gymbro_workout_resolve','gymbro_migration_initialize'].includes(rpc)) return refuse();
    let body;
    try {body = JSON.parse(options.body ?? '{}');} catch {return refuse();}
    const action = rpc.endsWith('_snapshot') ? 'read' : body.packet?.action ?? body.operation?.[0];
    if (!current.actions.includes(action)) return refuse();
  }
  async function sourceGuard(config,text) {
    const current = await verify(config);
    if (!current.syntheticOnly && await WorkoutMigration.digest(text) !== current.sourceByteDigest) return refuse();
  }
  return Object.freeze({active,configuration,verify,beforeFetch,sourceGuard});
})();
