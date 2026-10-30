const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,sdk,project}=require('../scripts/issue40-staging-fixtures.cjs');
const tag='gymbro-issue40-11111111-1111-4111-8111-111111111111';
const state=()=>({project,tag,accounts:[0,1].map(i=>({email:`${tag}-${i}@example.invalid`,id:null}))});
test('fixture identity guard accepts only the two planned staging accounts',()=>{
  assert.equal(validate(state()).project,project);
  for(const change of [s=>s.project='production',s=>s.tag='gymbro-issue40-'+ '-'.repeat(36),s=>s.accounts.pop(),s=>s.accounts[0].email='unrelated@example.invalid',s=>s.accounts[0].id="bad'owner"]){const s=state();change(s);assert.throws(()=>validate(s));}
});
test('fixture identity guard rejects duplicate owner IDs before any cleanup',()=>{
  const s=state();s.accounts.forEach(a=>a.id='22222222-2222-4222-8222-222222222222');assert.throws(()=>validate(s));
});
test('existing pinned browser SDK exposes operator admin API without an added dependency',()=>{
  const client=sdk().createClient(`https://${project}.supabase.co`,'sb_publishable_fixture_only',{auth:{persistSession:false,autoRefreshToken:false}});
  assert.equal(typeof client.auth.admin.createUser,'function');assert.equal(typeof client.auth.admin.deleteUser,'function');
});
