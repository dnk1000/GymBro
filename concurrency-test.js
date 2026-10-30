// Explicit staging-only adapter. Never imported by normal GymBro startup.
(() => {
  const el=id=>document.getElementById(id);
  let client,config,controller,ownerId=null,authIdentity=null,epoch=0;
  el('build').textContent=APP_VERSION.version;
  const message=text=>{el('status').textContent=text;};
  function invalidate() {epoch++;controller?.dispose();controller=null;ownerId=null;el('mutation').disabled=true;el('saved').textContent='Not connected.';}
  function paint(result) {
    if(!controller) return;
    const status=controller.getStatus();
    el('submit').disabled=status.phase!=='READY';
    el('retry').disabled=!status.canRetry;el('resolve').disabled=!status.canResolve;
    el('saved').textContent=JSON.stringify({revision:status.revision,workout:controller.getWorkoutState()},null,2);
    if(status.message) message(status.message);
    else if(result) message(result.errors?.length?result.errors.join(' '):result.code==='OK'?`Saved. Revision ${status.revision}.`:
      result.code==='REPLAY'?`Original request confirmed. Current revision ${status.revision}.${result.deleted?' The original set was subsequently deleted.':''}`:
      `Saved data refreshed. Revision ${status.revision}. Review your draft before submitting.`);
    else message(status.message||`Connected to synthetic staging data. Revision ${status.revision}.`);
  }
  function fixtureValid(document) {return document?.data?.extension?.concurrencyFixture===config.fixtureTag;}
  async function connect() {
    invalidate();const current=epoch;
    try {
      const user=await client.auth.getUser();
      if(user.error || !user.data.user || user.data.user.is_anonymous || !config.allowedOwners.includes(user.data.user.id)) throw Error('identity');
      const id=user.data.user.id;
      const transport={rpc:async(name,args)=> {
        const lose=name==='gymbro_workout_mutate'&&el('loseAcknowledgement').checked;
        const delay=name==='gymbro_workout_mutate'&&el('delayAcknowledgement').checked;
        if(name==='gymbro_workout_mutate') {el('loseAcknowledgement').checked=false;el('delayAcknowledgement').checked=false;}
        const response=await client.rpc(name,args);
        if(delay) await new Promise(resolve=>setTimeout(resolve,3000));
        if(lose && !response.error) throw Error('Deliberate test acknowledgement loss');
        return response;
      }};
      const repository=WorkoutRepository.create({client:transport,ownerId:id});
      const initial=await repository.load();
      if(current!==epoch) return;
      if(!initial.initialized || !fixtureValid(initial.document)) throw Error('fixture');
      ownerId=id;controller=WorkoutRepository.createActions({initial,repository,recoveryStorage:sessionStorage,
        createId:()=>`issue40-${crypto.randomUUID()}`});
      el('mutation').disabled=false;
      if(el('arguments').value==='[]') el('arguments').value=JSON.stringify([{date:initial.document.data.sessions[0]?.date??'2026-10-28',
        exercise:initial.document.catalog.exercises[0].id,weight:0,reps:8,rir:0,complete:false,notes:'  synthetic draft\n',sessionId:null}],null,2);
      paint();
    } catch {if(current===epoch) message('Synthetic session could not be opened. Check access and the expected fixture. No workout mutation was sent.');}
  }
  async function run(method,args=[]) {
    if(!controller) return;
    const active=controller,current=epoch;
    const pending=active[method](...args);paint();
    const result=await pending;
    if(current!==epoch || active!==controller) return;
    if(!fixtureValid(active.getWorkoutState())) {invalidate();message('Unexpected fixture contents. Saving is paused.');return;}
    paint(result);
  }
  el('submit').onclick=()=> {
    try {
      const args=JSON.parse(el('arguments').value);
      if(!Array.isArray(args)) throw Error('arguments');
      return run('execute',[el('action').value,...args]);
    } catch {message('Enter a valid JSON array. Your draft is unchanged; nothing was sent.');}
  };
  for(const method of ['refresh','retry','resolve']) el(method).onclick=()=>run(method);
  el('connect').onclick=connect;
  el('signIn').onclick=async()=> {
    if(!client || !el('email').reportValidity()) return;
    invalidate();message('Checking synthetic account…');
    try {
      const response=await client.auth.signInWithPassword({email:el('email').value,password:el('password').value});
      if(response.error) throw Error('access');
      el('password').value='';await connect();
    } catch {message('Synthetic account sign-in failed. No workout mutation was sent.');}
  };
  el('signOut').onclick=async()=> {invalidate();const response=await client.auth.signOut({scope:'local'});message(response.error?'Local account view closed; server sign-out unconfirmed.':'Signed out.');};
  (async()=> {
    try {
      const response=await fetch('/api/concurrency-config',{cache:'no-store'});config=await response.json();
      if(!response.ok || !config.enabled || !config.configured) {message('Concurrency checks are disabled or unconfigured for this environment.');return;}
      client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:`gymbro-concurrency-test-auth-${config.projectRef}`,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
      client.auth.onAuthStateChange((event,session)=> {
        const next=session?.user?.id??null;
        if(event==='SIGNED_OUT' || next!==authIdentity) {authIdentity=next;invalidate();message('Account changed. Connect the intended synthetic account before continuing.');}
      });
      el('access').disabled=false;message('Staging checks enabled. Connect a dedicated synthetic account.');
    } catch {message('Staging configuration could not load. No workout mutation was sent.');}
  })();
})();
