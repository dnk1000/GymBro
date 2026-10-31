// #28 initial delivery is restricted to configured synthetic staging fixtures.
// Personal/local-copy migration remains disabled pending M0/#27 readiness.
function renderCloudExerciseInput() {
  const selected=fExercise.value;
  fExercise.innerHTML='<option value="">Choose exercise</option>'+allExercises().map(id=>`<option value="${esc(id)}">${esc(exerciseName(id))}</option>`).join('')+'<option value="__new__">New exercise…</option>';
  fExercise.value=[...fExercise.options].some(o=>o.value===selected)?selected:'';
}
(() => {
  const data=document.getElementById('data'),host=document.createElement('div');
  host.className='card';host.id='previewCloud';data.prepend(host);
  if(!cloudMode){host.hidden=true;fetch('/api/workout-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(c=>{if(c?.enabled&&c.configured)host.hidden=false;}).catch(()=>{});host.innerHTML='<h2>Preview cloud workouts</h2><p>Opening cloud mode never uploads local history.</p><a href="?storage=cloud">Open staging cloud workouts</a>';return;}
  for(const child of [...data.children])if(child!==host&&child.id!=='accountAccess'){child.hidden=true;child.style.display='none';}
  document.getElementById('storageNotice').hidden=true;
  document.querySelector('[data-view="data"]').click();
  const fields=[];
  for(const view of document.querySelectorAll('.view'))if(view.id!=='data'){
    const f=document.createElement('fieldset');f.style.cssText='border:0;margin:0;padding:0;min-width:0';
    f.append(...view.childNodes);view.append(f);f.disabled=true;fields.push(f);
  }
  const select=document.createElement('select');select.id='fExercise';select.setAttribute('aria-label','Exercise');
  fExercise.replaceWith(select);fExercise=select;
  const label=document.createElement('input');label.id='newExerciseLabel';label.placeholder='Exact new exercise name';label.hidden=true;label.setAttribute('aria-label','New exercise name');select.after(label);
  select.onchange=()=>{label.hidden=select.value!=='__new__';};
  host.innerHTML=`<h2>Synthetic staging cloud workouts</h2><p>Only dedicated test accounts and matching tagged synthetic sources are enabled. Personal backup and local-copy migration are disabled pending M0/#27 readiness. Production workouts remain local.</p>
    <p id="cloudStatus" role="status" aria-live="polite">Sign in through Account access, then connect.</p><button id="cloudConnect">Connect test account</button>
    <button id="cloudRefresh">Refresh saved data</button><button id="cloudRetry">Retry same request</button><button id="cloudResolve">Check result / cancel unresolved request</button>
    <fieldset id="migrationControls" disabled><legend>Deliberate synthetic migration</legend><input id="migrationFile" type="file" accept="application/json" aria-label="Synthetic migration fixture">
    <button id="migrationReview">Validate and review synthetic fixture</button><pre id="migrationSummary" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>
    <button id="migrationCommit" disabled>Confirm synthetic migration</button><button id="migrationReport" disabled>Download comparison report</button></fieldset><div id="cloudLifecycle"></div>`;
  const el=id=>document.getElementById(id);let account=null,epoch=0,panel=null,review=null,report=null,config=null,shownRevision=null,accountBlocked=false;
  const say=text=>el('cloudStatus').textContent=text;
  const support=OperationalDiagnostics.mount(host);
  function diagnose(error,operation='initial load') {say(support.update({error,operation,config,status:cloudController?.getStatus(),handle:cloudController?.getSnapshot()}));}
  function publish(controller,result,operation='initial load'){
    if(controller!==cloudController)return;
    const h=controller.getSnapshot(),s=controller.getStatus();panel?.update(result);
    if(result?.ok && result.changes?.includes('workoutData')){noteDrafts.clear();selectedNoteOccurrence=null;clearForm();clearInbox();}
    let parityBlocked=true;try{parityBlocked=sessionStorage.getItem(`gymbro-migration-parity-v1-${h.ownerId}`)!==null;}catch{say('Request recovery metadata is unavailable; saving is paused.');}
    cloudReady=h.status==='healthy'&&!parityBlocked&&!accountBlocked;
    if(cloudReady && shownRevision!==h.revision){db=WorkoutRepository.presentation(h.document);shownRevision=h.revision;renderAll();}
    for(const f of fields)f.disabled=!cloudReady||s.phase!=='READY';
    el('migrationControls').disabled=accountBlocked||s.phase!=='READY';el('migrationCommit').disabled=accountBlocked||!review||s.phase!=='READY';
    el('cloudRetry').disabled=accountBlocked||!s.canRetry;el('cloudResolve').disabled=accountBlocked||!s.canResolve;
    el('cloudLifecycle').querySelectorAll('fieldset[data-controls]').forEach(f=>f.disabled=accountBlocked);
    const diagnosticMessage=support.update({operation,config,status:{...s,code:result?.code},handle:h,parity:parityBlocked&&h.status==='healthy'});
    say(s.diagnostic || s.phase==='LOAD_ERROR' || h.status!=='healthy' ? diagnosticMessage : parityBlocked&&h.status==='healthy'?'Migration verification or recovery metadata is pending; editing is blocked.':s.message||(result?`Cloud request ${result.code}. Revision ${h.revision}.`:`Cloud state: ${h.status}. Revision ${h.revision}.`));
  }
  function invalidate(){
    epoch++;panel?.dispose();panel=null;cloudController?.dispose();cloudController=null;cloudReady=false;
    db=emptyData();noteDrafts.clear();selectedNoteOccurrence=null;selectedExercise='';selectedTemplateId=null;
    clearForm();clearInbox();expandedHistoryGroups.clear();for(const f of fields){f.disabled=true;f.hidden=true;}
    support.update({operation:'account'});el('migrationFile').value='';shownRevision=null;review=report=null;el('migrationSummary').textContent='';el('cloudLifecycle').replaceChildren();el('migrationControls').disabled=true;
    el('migrationCommit').disabled=el('cloudRetry').disabled=el('cloudResolve').disabled=true;
  }
  invalidate();window.addEventListener('gymbro-account',event=>{const next=event.detail,unchanged=account&&next&&account.user.id===next.user.id&&account.client===next.client&&account.config.projectRef===next.config.projectRef;account=next;accountBlocked=false;if(unchanged){if(cloudController)publish(cloudController);return;}invalidate();say(account?'Account verified. Connect synthetic cloud workouts.':'Sign in to connect cloud workouts.');});
  window.addEventListener('gymbro-account-unavailable',()=>{accountBlocked=true;cloudReady=false;for(const f of fields)f.disabled=true;el('migrationControls').disabled=true;el('cloudLifecycle').querySelectorAll('fieldset[data-controls]').forEach(f=>f.disabled=true);el('cloudRetry').disabled=el('cloudResolve').disabled=true;diagnose(OperationalDiagnostics.failure('AUTH','Verify account access again.'),'account');});
  el('cloudConnect').onclick=async()=>{
    if(accountBlocked){diagnose(OperationalDiagnostics.failure('AUTH','Verify account access again.'),'account');return;}
    if(cloudController){await cloudController.refresh();return;}
    const generation=++epoch;
    try{
      const response=await fetch('/api/workout-config',{cache:'no-store'});config=await response.json();
      if(!response.ok||!config.enabled||!config.configured||!config.syntheticOnly||!account||account.config.projectRef!==config.projectRef)throw OperationalDiagnostics.failure(!account?'AUTH':'CONFIGURATION','Synthetic Preview capability unavailable.');
      const verified=await account.client.auth.getUser();
      if(verified.error)throw OperationalDiagnostics.transport(verified.error);
      if(verified.data.user?.is_anonymous||verified.data.user?.id!==account.user.id||!config.allowedOwners.includes(account.user.id))throw OperationalDiagnostics.failure('DENIED','Dedicated staging test owner required.');
      const ownerId=account.user.id,repository=WorkoutLifecycle.createRepository({client:account.client,ownerId}),initial=await repository.load();
      if(generation!==epoch)return;
      if(initial.status==='healthy'&&initial.document.data.extension?.previewMigrationFixture!==config.fixtureTag)throw OperationalDiagnostics.failure('CONFIGURATION','Unexpected destination contents.');
      cloudController=WorkoutCloud.create({client:account.client,ownerId,initial,recoveryStorage:sessionStorage,fixtureTag:config.fixtureTag,onChange:publish});
      panel=WorkoutLifecyclePanel.mount(el('cloudLifecycle'),{controller:cloudController,environment:'GymBro-Staging — synthetic fixtures only',ownerId,config,cutoverAccepted:false});
      for(const f of fields)f.hidden=false;publish(cloudController);
    }catch(error){if(generation===epoch)diagnose(error);}
  };
  for(const [id,method]of[['cloudRefresh','refresh'],['cloudRetry','retry'],['cloudResolve','resolve']])el(id).onclick=async()=>{
    if(!cloudController)return;const op=cloudController.getStatus().operation,result=await cloudController[method]();
    if(result.ok&&method!=='refresh'&&op){clearForm();clearInbox();noteDrafts.clear();}
  };
  el('migrationFile').onchange=()=>{review=null;el('migrationCommit').disabled=true;};
  el('migrationReview').onclick=async()=>{
    const generation=epoch,controller=cloudController;review=null;el('migrationCommit').disabled=true;
    try{
      const file=el('migrationFile').files[0];if(!file||!controller)throw OperationalDiagnostics.failure('VALIDATION','Connect and select a synthetic fixture.');
      const text=await file.text(),candidate=await WorkoutMigration.prepareSource(text,controller.getSnapshot().ownerId);
      if(candidate.document.data.extension?.previewMigrationFixture!==config.fixtureTag)throw OperationalDiagnostics.failure('VALIDATION','Configured synthetic fixtures only.');
      if(generation!==epoch)return;
      review={text,candidate,revision:controller.getSnapshot().revision};const d=candidate.document.data;
      el('migrationSummary').textContent=`Synthetic file: ${file.name}\nSchema ${candidate.sourceSchema}; exporting build ${candidate.sourceBuild??'not recorded'}\nSHA-256 ${candidate.byteDigest}\n${d.sets.length} sets; ${d.sessions.length} sessions; ${d.bodyweights.length} bodyweights; ${candidate.document.catalog.exercises.length} exercises. Active: ${d.activeSessionId??'none'}.\nExact labels stay separate. All notes/metadata are retained.\nDestination ${controller.getSnapshot().ownerId}; staging only. Populated differences reject.`;
      el('migrationCommit').disabled=controller.getStatus().phase!=='READY';
    }catch(error){diagnose(error,'migration');}
  };
  el('migrationCommit').onclick=async()=>{
    const selected=review,controller=cloudController,generation=epoch;
    try{
      if(!selected||!controller||selected.revision!==controller.getSnapshot().revision)throw OperationalDiagnostics.failure('VALIDATION','Review the current source and destination first.');
      if(!confirm(`Initialize SYNTHETIC migration on GymBro-Staging for ${controller.getSnapshot().ownerId}? Only an empty destination may change; an exact full candidate is a no-op.`))return;
      const marker='gymbro-migration-parity-v1-'+controller.getSnapshot().ownerId;
      const hadMarker=sessionStorage.getItem(marker)!==null;sessionStorage.setItem(marker,'pending');
      const result=await controller.execute('initializeMigration',{text:selected.text,confirmed:true});
      if(generation!==epoch)return;
      if(!result.ok){if(!hadMarker && ['VALIDATION_ERROR','CONFLICT','CANCELLED'].includes(result.code))sessionStorage.removeItem(marker);publish(controller,result);return;}
      // Fence dependent editing until fresh all-field comparison succeeds.
      const key=`gymbro-migration-parity-v1-${controller.getSnapshot().ownerId}`;sessionStorage.setItem(key,'pending');publish(controller);
      if(!(await controller.refresh()).ok)throw OperationalDiagnostics.failure('PARITY','Migration acknowledged; verification pending.');
      report={...WorkoutMigration.compare(selected.candidate,controller.getSnapshot(),controller.getSnapshot().ownerId),sourceDigest:selected.candidate.sourceDigest,byteDigest:selected.candidate.byteDigest,appVersion:APP_VERSION.version};
      el('migrationReport').disabled=false;
      if(!report.pass)throw OperationalDiagnostics.failure('PARITY','Migration committed; parity failed.');
      sessionStorage.removeItem(key);publish(controller);say(`Migration verified: all ${report.tables.length} tables match canonical content and relationships. Revision ${report.revision}.`);
    }catch(error){say(error.message);}
  };
  el('migrationReport').onclick=()=>{if(report)download('gymbro-synthetic-migration-comparison.json','application/json',JSON.stringify(report,null,2));};
})();
