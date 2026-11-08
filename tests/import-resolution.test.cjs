const {test}=require('node:test'),assert=require('node:assert/strict');
const {runtime}=require('./relational-fixture.cjs');
const {plain}=require('./protocol-fixture.cjs');
function fixture(){
  const r=runtime(),resolver=r.get('ImportResolution');
  let catalog={exercises:[],aliases:[]};
  for(const [n,id] of [['Rope Triceps Pushdown','11111111-1111-4111-8111-111111111111'],['Incline Smith Press','22222222-2222-4222-8222-222222222222'],['Smith Bench Press','33333333-3333-4333-8333-333333333333']])
    catalog=r.identity.createExercise(catalog,{id,displayName:n,provenance:'user-created',equipment:'Smith machine'});
  return {...r,resolver,catalog,id:catalog.exercises[0].id,normalize:r.get('normalizeInboxPayload')};
}
const row=exercise=>({exercise,include:true,weight:0,reps:7,unit:'lb',rpe:7,rir:2,pain:0,painArea:'',notes:'  exact\n',complete:false});
test('unknown labels require deliberate review; exact names/equipment variants stay separate',()=>{
  const f=fixture(),before=plain(f.catalog),rows=['Rope Triceps Pressdown','rope triceps pushdown',' Rope Triceps Pushdown','Dumbbell Incline Press','Incline Smith Press','Smith Bench Press'].map(row);
  const result=f.resolver.review(f.catalog,rows);
  assert.equal(result.errors.length,4);assert.equal(result.groups.at(-2).exerciseId,f.catalog.exercises[1].id);
  assert.notEqual(result.groups.at(-2).exerciseId,result.groups.at(-1).exerciseId);assert.deepEqual(plain(f.catalog),before);
});
test('mapping saves one explicit alias and preserves original labels without rewriting facts or import ID',()=>{
  const f=fixture(),draft=f.normalize({date:'2026-11-07',sets:[row('Rope Triceps Pressdown'),row('Rope Triceps Pressdown')]});
  const before=plain(draft);draft.resolutions=[{label:draft.sets[0].exercise,kind:'map',exerciseId:f.id}];
  const result=f.resolver.prepare(f.catalog,draft);
  assert.equal(result.draft.importId,before.importId);assert.equal(result.catalog.exercises.length,3);assert.equal(result.catalog.aliases.length,4);
  for(const s of result.draft.sets){assert.equal(s.exercise,f.id);assert.equal(s.originalLabel,'Rope Triceps Pressdown');assert.equal(s.notes,'  exact\n');assert.equal(s.complete,false);assert.equal(s.weight,0);}
  assert.equal(f.resolver.review(result.catalog,[row('Rope Triceps Pressdown')]).groups[0].status,'alias');
  assert.equal(f.catalog.aliases.length,3);
});
test('create allocates only in preparation; excluded rows create no catalog changes',()=>{
  const f=fixture(),draft={importId:'new',date:'2026-11-07',sets:[row('Cable New'),row('Cable New'),row('Skip New')],resolutions:[{label:'Cable New',kind:'create'},{label:'Skip New',kind:'skip'}]};
  const review=f.resolver.review(f.catalog,draft.sets,draft.resolutions);assert.equal(review.catalog.exercises.length,3);assert.equal(review.included,2);assert.equal(review.excluded,1);
  const a=f.resolver.prepare(f.catalog,draft);assert.equal(a.catalog.exercises.length,4);assert.equal(a.draft.sets[0].exercise,a.draft.sets[1].exercise);assert.equal(a.draft.sets[2].include,false);
  assert.equal(a.catalog.exercises.at(-1).provenance,'import-created');assert.equal(a.catalog.exercises.at(-1).primary,'Uncategorized');
  assert.throws(()=>f.resolver.prepare(f.catalog,{...draft,sets:[row('Skip New')]}),/Select at least|Choose at least|include|selected/i);
});
test('conflicting identity, missing targets, duplicate decisions and stale creation reject',()=>{
  const f=fixture();
  for(const decision of [{label:'Rope Triceps Pushdown',kind:'map',exerciseId:f.catalog.exercises[1].id},{label:'Rope Triceps Pushdown',kind:'create'},{label:'Unknown',kind:'map',exerciseId:'missing'}])
    assert(f.resolver.review(f.catalog,[row(decision.label)],[decision]).errors.length);
  assert.throws(()=>f.resolver.review(f.catalog,[row('Unknown')],[{label:'Unknown',kind:'create'},{label:'Unknown',kind:'skip'}]),/duplicate/);
});
test('canonical IDs and aliases resolve automatically; selection preserves existing generated import IDs',()=>{
  const f=fixture();f.catalog=f.identity.addAlias(f.catalog,{label:'Explicit alias',exerciseId:f.id,provenance:'user-created'});
  const draft=f.normalize({session:{date:'2026-11-07',exercises:[{exercise:'Explicit alias',sets:[row('Explicit alias')]}]}}),id=draft.importId;
  const prepared=f.resolver.prepare(f.catalog,draft);assert.equal(prepared.draft.importId,id);assert.equal(prepared.groups[0].status,'alias');
  const direct=f.resolver.prepare(f.catalog,{...draft,sets:[row(f.id)]});assert.equal(direct.draft.sets[0].originalLabel,'Rope Triceps Pushdown');
  const skipped=f.resolver.review(f.catalog,[{...row('Unused unknown'),include:false},row(f.id)],[{label:'Unused unknown',kind:'create'}]);assert.equal(skipped.catalog.exercises.length,3);
});
