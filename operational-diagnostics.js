// Presentation only: no storage, telemetry, raw error serialization or retries.
const OperationalDiagnostics = (() => {
  const tagged = new WeakMap();
  const own = (value, key) => {
    try { const d = Object.getOwnPropertyDescriptor(value, key); return d && Object.hasOwn(d, 'value') ? d.value : undefined; }
    catch { return undefined; }
  };
  const causes = Object.freeze({
    NETWORK: 'Connectivity is unavailable. Check your connection.',
    TIMEOUT: 'The service did not respond in time.',
    DATABASE: 'The database service is unavailable. Try again later.',
    AUTH: 'Your account session could not be verified. Refresh account access or request a fresh sign-in link.',
    DENIED: 'This account is not authorized for this operation. Verify the selected account.',
    RATE_LIMIT: 'Too many requests. Wait before trying again.',
    COMPATIBILITY: 'This data or service response is incompatible with this app. Keep the original material and reload the current app before seeking recovery help. Reload may lose unsaved entries and file choices.',
    CONFIGURATION: 'Cloud access is disabled or unconfigured for this environment. Verify the Preview configuration.',
    VALIDATION: 'The input could not be validated. Review the selected file or entered values and the operation requirements.',
    PARITY: 'Migration verification or recovery metadata is pending. Editing is blocked. Preserve the source and comparison report; refresh saved data and verify the comparison before recovery.',
    UNKNOWN: 'The operation could not be verified. Preserve this tab and try the indicated recovery action.',
  });
  function failure(kind, message, display = false) {
    const error = Error(message); tagged.set(error, {kind:Object.hasOwn(causes, kind) ? kind : 'UNKNOWN', message:display?message:null}); return error;
  }
  function classify(error, offline = false) {
    if (tagged.has(error)) return tagged.get(error).kind;
    const code = own(error, 'code'), status = own(error, 'status'), name = own(error, 'name');
    if (['PGRST301','PGRST302','PGRST303','bad_jwt','session_not_found','refresh_token_not_found','refresh_token_already_used','otp_expired'].includes(code) || status === 401) return 'AUTH';
    if (code === '42501' || status === 403) return 'DENIED';
    if (status === 429 || ['over_request_rate_limit','over_email_send_rate_limit'].includes(code)) return 'RATE_LIMIT';
    if (['PGRST202','PGRST204','42883','42P01','42703'].includes(code)) return 'COMPATIBILITY';
    if (['AbortError','TimeoutError'].includes(name) || [408,504].includes(status)) return 'TIMEOUT';
    if ([500,502,503].includes(status) || ['08000','08003','08006','53300','57P01','PGRST000','PGRST001','PGRST002'].includes(code)) return 'DATABASE';
    if (offline || status === 0 || name === 'TypeError' || error instanceof TypeError) return 'NETWORK';
    return 'UNKNOWN';
  }
  // Retain only a fixed class alongside the legacy code needed by the protocol.
  // No HTTP/code classification changes whether a mutation is acknowledged.
  function transport(error, status) {
    const safe = failure(classify({code:own(error,'code'),status:typeof status==='number'?status:own(error,'status'),name:own(error,'name')}), 'Cloud operation could not be verified.');
    const code = own(error,'code');
    if (typeof code === 'string' && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code)) safe.code = code;
    return safe;
  }
  const operations = ['account','configuration','initial load','refresh','save','migration','export','restore','merge','resolution'];
  const phases = ['READY','PENDING','OUTCOME_UNKNOWN','CONFLICT','REQUEST_CONFLICT','CANCELLED','RECOVERY_ERROR','RECOVERY_BLOCKED','RECOVERY_PENDING','LOAD_ERROR','AUTHORIZATION_ERROR','VALIDATION_ERROR','DISPOSED'];
  function describe({operation='initial load',status={},handle={},error,config,mode='cloud',parity=false}={}) {
    const phase = phases.includes(status.phase) ? status.phase : 'UNAVAILABLE';
    const cause = parity ? 'PARITY' : Object.hasOwn(causes,status.diagnostic) ? status.diagnostic : classify(error,globalThis.navigator?.onLine===false);
    let message = '';
    if (['PENDING','OUTCOME_UNKNOWN','CONFLICT','REQUEST_CONFLICT','RECOVERY_ERROR','RECOVERY_BLOCKED','RECOVERY_PENDING','AUTHORIZATION_ERROR'].includes(phase)) message = WorkoutConcurrency.messages[phase];
    else if (phase==='LOAD_ERROR') message = WorkoutConcurrency.messages.LOAD_ERROR+' The last acknowledged view is retained. Refresh saved data to retry.';
    else if (status.code==='VALIDATION_ERROR') message = WorkoutConcurrency.messages.VALIDATION_ERROR;
    else if (parity) message = causes.PARITY;
    else if (handle.status==='uninitialized' || handle.status==='unreadable') message = `Verified cloud state: ${handle.status}. This is not an empty valid account. Use the separately confirmed migration or recovery controls in Data.`;
    else if (error && operation==='initial load') message = 'Saved cloud workouts could not load. No account contents are shown. Retry connecting after checking account access and connectivity.';
    if (error || status.diagnostic) message += (message?' ':'')+(tagged.get(error)?.message || causes[cause]);
    if (!message) message = status.message || (operation==='initial load'?'Connect a verified account to load saved cloud workouts.':'Review saved data before continuing.');
    const verified = config?.configured===true && config.enabled===true && ['preview','local'].includes(config.environment) && config.projectRef==='obebuvpsqapgevwivwho';
    const summary = {
      appVersion: APP_VERSION.version,
      supported: {workout:8,identity:1,model:1,protocol:1,cloudBackup:1},
      observedWorkout: handle.status==='healthy' ? 8 : 'unknown',
      environment: verified ? (config.environment==='preview'?'Preview':'Local test against Preview') : 'unknown/unverified',
      project: verified ? config.projectRef : 'unknown/unverified',
      authority: mode==='local'?'local workout storage':'synthetic cloud Preview; no Production cutover',
      operation: operations.includes(operation)?operation:'configuration',
      classification: ['CONFLICT','REQUEST_CONFLICT','PENDING','OUTCOME_UNKNOWN','AUTHORIZATION_ERROR','VALIDATION_ERROR'].includes(phase)?phase:phase.startsWith('RECOVERY_')?'RECOVERY':status.code==='VALIDATION_ERROR'?'VALIDATION_ERROR':parity?'PARITY':['uninitialized','unreadable'].includes(handle.status)?'RECOVERY':cause, cause, phase,
      acknowledgement:phase==='OUTCOME_UNKNOWN'?'unknown':phase==='PENDING'?'pending':phase==='RECOVERY_PENDING'?'confirmed; recovery cleanup pending':'no new save claimed',
      actions: [status.canRetry?'Retry same request':null,status.canResolve?'Check result / cancel unresolved request':null,
        ['READY','CONFLICT','LOAD_ERROR','AUTHORIZATION_ERROR'].includes(phase)?'Refresh saved data':null].filter(Boolean),
    };
    return {message,summary};
  }
  function mount(host,defaults={}) {
    const details=document.createElement('details'),title=document.createElement('summary'),pre=document.createElement('pre'),copy=document.createElement('button'),notice=document.createElement('p');
    title.textContent='Safe support details';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    copy.type='button';copy.textContent='Copy safe support summary';notice.setAttribute('role','status');
    details.append(title,pre,copy,notice);host.append(details);
    const correlation=crypto.randomUUID();
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(pre.textContent);notice.textContent='Safe support summary copied.';}catch{notice.textContent='Clipboard unavailable. Select and copy the support text above.';}};
    return {update(context){const model=describe({...defaults,...context});pre.textContent=JSON.stringify({...model.summary,correlation},null,2);notice.textContent='';return model.message;}};
  }
  return Object.freeze({classify,failure,transport,describe,mount});
})();
