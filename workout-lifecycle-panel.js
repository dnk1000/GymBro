// Reusable Data panel. Host supplies verified authority; sign-in is not cutover.
const WorkoutLifecyclePanel = (() => {
  function mount(host,{controller,environment,ownerId,storage=globalThis.localStorage,cutoverAccepted=false,
    confirm=message=>globalThis.confirm(message),download=(name,text)=>{
      const url=URL.createObjectURL(new Blob([text],{type:name.endsWith('.csv')?'text/csv':'application/json'}));const a=document.createElement('a');
      a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }}) {
    let live=true,sequence=0,safety=null,review=null,rawOffered=false;
    const cleanup=WorkoutLifecycle.localRecovery({storage,cutoverAccepted,onChange:()=>say('Local recovery data changed. Capture and verify it again.')});
    host.innerHTML=`<p data-authority></p><p data-status role="status" aria-live="polite"></p>
      <fieldset data-controls><legend>Cloud workout backup and recovery</legend>
      <button data-export>Export complete cloud backup</button><button data-legacy>Export legacy JSON</button><button data-csv>Export sets CSV</button>
      <label>Backup operation<select data-mode><option value="restore">Restore cloud workout backup</option><option value="merge">Merge workout history</option></select></label>
      <p>Complete restore replaces all cloud workouts, catalog, program, notes, preferences and imports. Account access and local recovery files are retained. History merge keeps current settings, program and existing records.</p>
      <label>Incoming JSON file<input data-incoming type="file" accept="application/json"></label><button data-review>Validate and review file</button>
      <pre data-summary></pre><label>Reopen the current complete cloud recovery file before healthy restore<input data-safety type="file" accept="application/json"></label>
      <button data-verify>Verify saved recovery backup</button><button data-raw>Download raw cloud diagnostic material</button>
      <label><input data-emergency type="checkbox"> Emergency recovery: I understand this cloud state is unreadable or uninitialized and has no verified complete recovery backup.</label>
      <button data-commit disabled>Confirm reviewed operation</button><button data-refresh>Refresh saved cloud data</button>
      <button data-retry>Retry same request</button><button data-resolve>Check result / cancel unresolved request</button>
      <p>Pending and unconfirmed writes are never reported saved. Refresh keeps file choices; review again before a new request. Reload may lose unsaved file choices.</p></fieldset>
      <fieldset><legend>This browser's inactive local recovery material</legend><p data-local-note></p>
      <button data-local-export>Download original local recovery bytes</button><label>Reopen saved raw local file<input data-local-file type="file"></label>
      <label><input data-tabs type="checkbox"> I closed or reloaded all old GymBro app tabs.</label>
      <button data-local-delete>Delete this browser's local recovery copy</button></fieldset>
      <p>Separate cloud reset is not supported. Account and associated-data deletion are deferred. Sign-out does not delete data. Local cleanup never resets cloud workouts or deletes the account.</p>`;
    const el=name=>host.querySelector(`[data-${name}]`);
    host.querySelectorAll('fieldset').forEach(field=>field.style.minWidth='0');
    el('summary').style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    el('authority').textContent=`${environment} · Account ${ownerId} · Cloud workout data. Normal GymBro activation follows accepted migration/cutover.`;
    el('local-note').textContent=cutoverAccepted?'Deletes only this browser recovery copy after raw backup verification; cloud data and account are unaffected.':
      'Cleanup is disabled until accepted cutover. Current normal GymBro workouts still use their local store.';
    for(const n of ['local-export','local-file','local-delete','tabs']) el(n).disabled=!cutoverAccepted;
    const say=text=>{if(live)el('status').textContent=text;};
    function paint(result) {
      if(!live)return;const state=controller.getStatus(),handle=controller.getSnapshot();
      el('commit').disabled=state.phase!=='READY'||!review;
      for(const n of ['export','legacy','csv'])el(n).disabled=state.phase!=='READY'||handle.status!=='healthy';
      el('retry').disabled=!state.canRetry;el('resolve').disabled=!state.canResolve;
      if(state.message)say(state.message);
      else if(handle.status!=='healthy')say(`Cloud state is ${handle.status}. This is not an empty valid backup. Download raw diagnostic material before separately confirmed emergency restore.`);
      else if(result)say(result.ok?`Cloud request ${result.code}. Revision ${state.revision}.`:result.errors?.join(' ')||result.code);
      else say(handle.status==='healthy'?`Cloud data loaded. Revision ${state.revision}.`:
        `Cloud state is ${handle.status}. This is not an empty valid backup. Download raw diagnostic material before separately confirmed emergency restore.`);
    }
    async function run(method,...args) {const pending=controller[method](...args);paint();const result=await pending;paint(result);return result;}
    async function guard(action) {try{await action();}catch(e){say(e.message);} }
    function resetReview(){sequence++;review=null;safety=null;rawOffered=false;el('summary').textContent='';paint();}
    el('mode').onchange=resetReview;el('incoming').onchange=resetReview;
    el('review').onclick=()=>guard(async()=>{
      const id=++sequence,file=el('incoming').files[0],mode=el('mode').value,base=controller.getSnapshot();
      if(!file)throw Error('Select an incoming backup.');
      const text=await file.text();if(!live||id!==sequence)return;
      const incoming=await WorkoutLifecycle.parse(text,ownerId,mode==='merge'?{catalog:base.document?.catalog}:{});
      const candidate=mode==='merge'?WorkoutLifecycle.merge(base,incoming,ownerId):incoming;
      if(!live||id!==sequence)return;
      review={text,mode,fingerprint:base.fingerprint,revision:base.revision};
      const d=candidate.document.data,metadata=JSON.parse(text);
      const schema=incoming.kind==='cloud'?metadata.source.workoutVersion:metadata.version??1;
      const build=typeof metadata.appVersion==='string'?metadata.appVersion:'not recorded (older backup)';
      el('summary').textContent=`File: ${file.name}\nData schema: ${schema} · Exporting application: ${build}\n${mode==='merge'?'HISTORY MERGE — current settings/program and existing set IDs win':'COMPLETE RESTORE — replaces all cloud workout data'}\nResult: ${d.sets.length} sets, ${d.sessions.length} sessions, ${d.bodyweights.length} bodyweights, ${d.imports.length} imports. Active workout: ${d.activeSessionId??'none'}.\nAccount: ${ownerId}; ${environment}. Account access, transport receipts and local recovery files are retained.`;
      paint();say('File validated. Review the operation and recovery requirements before confirming.');
    });
    el('verify').onclick=()=>guard(async()=>{
      const id=sequence,file=el('safety').files[0];if(!file)throw Error('Select the saved complete cloud recovery file.');
      const text=await file.text();if(!live||id!==sequence)return;safety=WorkoutLifecycle.verifySafety(text,controller.getSnapshot());say('Saved recovery file verified for the current account/revision.');
    });
    el('export').onclick=()=>guard(async()=>{
      const result=await run('refresh');if(!live||!result.ok)return;
      const file=WorkoutLifecycle.backup(controller.getSnapshot());download('gymbro-cloud-backup.json',JSON.stringify(file,null,2));
      say(`Cloud snapshot exported at revision ${file.source.revision}. Save and reopen the file to verify recovery before restore.`);
    });
    for(const kind of ['legacy','csv'])el(kind).onclick=()=>guard(async()=>{
      const result=await run('refresh');if(!live||!result.ok)return;
      const handle=controller.getSnapshot();if(handle.status!=='healthy')throw Error('A healthy cloud snapshot is required.');
      const source=ExerciseIdentity.restoreV2Source(handle.document);
      if(kind==='legacy')download('gymbro-legacy-compatibility.json',JSON.stringify(createCompleteBackup(source),null,2));
      else {const fields=['date','exercise','weight','unit','reps','rpe','rir','pain','painArea','notes','source','complete'];
        const cell=x=>'"'+String(x??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
        download('gymbro-sets.csv',[fields.join(','),...source.sets.map(s=>fields.map(k=>cell(s[k])).join(','))].join('\n'));}
      say('Compatibility export saved. Complete cloud JSON is the full recovery format; CSV is sets-only.');
    });
    el('raw').onclick=()=>guard(async()=>{
      const handle=controller.getSnapshot();if(handle.status==='healthy')throw Error('Use complete cloud backup for healthy data.');
      download('gymbro-raw-cloud-diagnostics.json',JSON.stringify({format:'gymbro-raw-diagnostics',...handle},null,2));rawOffered=true;
      say('Raw diagnostic material offered for download. This is not a validated complete GymBro backup.');
    });
    el('commit').onclick=()=>guard(async()=>{
      const h=controller.getSnapshot();
      if(!review||review.fingerprint!==h.fingerprint||review.revision!==h.revision)throw Error('Cloud state changed. Review the file again.');
      const emergency=h.status!=='healthy'&&review.mode==='restore';
      if(emergency && (!rawOffered||!el('emergency').checked))throw Error('Download raw diagnostic material and acknowledge emergency recovery first.');
      if(!emergency&&review.mode==='restore'&&!safety)throw Error('Verify the saved complete cloud recovery file first.');
      const wording=emergency?'EMERGENCY RESTORE: the current cloud state could not be validated and cannot be proven recoverable as a complete backup. Replace all cloud workout data?':
        review.mode==='restore'?'COMPLETE RESTORE: replace all cloud workout history, catalog, program, notes, preferences and imports?':'MERGE HISTORY: add compatible history while preserving current program/settings and existing records?';
      if(!confirm(`${environment}\nAccount ${ownerId}\n${wording}\nAccount access and local recovery files are retained.`))return;
      const result=await run('execute',review.mode==='restore'?'restoreCompleteBackup':'mergeHistoryBackup',
        {text:review.text,safety,confirmed:true,emergencyConfirmed:emergency&&el('emergency').checked,rawOffered});
      if(result.ok){review=null;safety=null;paint(result);}
    });
    for(const method of ['refresh','retry','resolve'])el(method).onclick=()=>guard(async()=>{if(method==='refresh'){review=null;safety=null;rawOffered=false;}await run(method);});
    el('local-export').onclick=()=>guard(async()=>{download('gymbro-original-local-recovery.json',cleanup.capture());say('Original local bytes offered for download. Reopen that file before cleanup.');});
    el('local-delete').onclick=()=>guard(async()=>{
      const file=el('local-file').files[0];if(!file)throw Error('Select the saved raw local recovery file.');
      const text=await file.text();if(!live)return;cleanup.verify(text);
      if(!confirm('Delete only this browser\'s inactive local recovery copy? Cloud workouts and the account are unaffected.'))return;
      cleanup.remove({confirmed:true,oldTabsClosed:el('tabs').checked});say('This browser local recovery copy was deleted. Cloud workouts and account are unaffected.');
    });
    paint();return Object.freeze({update:paint,dispose(){live=false;sequence++;cleanup.dispose();controller.dispose();host.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);}});
  }
  return Object.freeze({mount});
})();
