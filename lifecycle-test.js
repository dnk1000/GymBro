// Opt-in synthetic Preview adapter; normal startup never loads this file.
(() => {
  const el=id=>document.getElementById(id);let client,config,panel,epoch=0,authIdentity=null;
  el('build').textContent=APP_VERSION.version;
  const message=text=>{el('status').textContent=text;};
  function invalidate(){epoch++;panel?.dispose();panel=null;el('lifecycle').replaceChildren();}
  async function connect(){invalidate();const generation=epoch;
    try{
      const response=await client.auth.getUser(),user=response.data?.user;
      if(response.error||!user||user.is_anonymous||!config.allowedOwners.includes(user.id))throw Error('Synthetic account required.');
      const transport={rpc:async(name,args)=>{
        const lose=name==='gymbro_lifecycle_mutate'&&el('loseAcknowledgement').checked;
        if(lose)el('loseAcknowledgement').checked=false;
        const reply=await client.rpc(name,args);if(lose&&!reply.error)throw Error('Deliberate lost acknowledgement');return reply;
      }};
      const repository=WorkoutLifecycle.createRepository({client:transport,ownerId:user.id}),initial=await repository.load();
      if(generation!==epoch)return;
      // The allowlist admits only operator-created empty/marked synthetic owners.
      if(initial.status==='healthy'&&initial.document.data.extension?.lifecycleFixture!==config.fixtureTag)throw Error('Unexpected fixture contents.');
      const controller=WorkoutLifecycle.createController({initial,repository,recoveryStorage:sessionStorage});
      panel=WorkoutLifecyclePanel.mount(el('lifecycle'),{controller,environment:'GymBro-Staging Preview — synthetic data',ownerId:user.id});
      message('Synthetic staging account connected.');
    }catch(e){if(generation===epoch)message('Synthetic session could not be verified. No lifecycle operation is enabled.');}
  }
  el('connect').onclick=connect;
  el('signIn').onclick=async()=>{invalidate();try{
    const reply=await client.auth.signInWithPassword({email:el('email').value,password:el('password').value});
    if(reply.error)throw Error('access');el('password').value='';await connect();
  }catch{message('Synthetic account sign-in failed.');}};
  el('signOut').onclick=async()=>{invalidate();const reply=await client.auth.signOut({scope:'local'});message(reply.error?'View closed; sign-out unconfirmed.':'Signed out.');};
  (async()=>{try{
    const reply=await fetch('/api/lifecycle-config',{cache:'no-store'});config=await reply.json();
    if(!reply.ok||!config.enabled||!config.configured){message('Lifecycle checks are disabled or unconfigured.');return;}
    client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:`gymbro-lifecycle-test-auth-${config.projectRef}`,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    client.auth.onAuthStateChange((event,session)=>{const next=session?.user?.id??null;if(event==='SIGNED_OUT'||next!==authIdentity){authIdentity=next;invalidate();}});
    el('access').disabled=false;message('Connect a dedicated synthetic staging account.');
  }catch{message('Staging configuration failed. No lifecycle operation is enabled.');}})();
})();
