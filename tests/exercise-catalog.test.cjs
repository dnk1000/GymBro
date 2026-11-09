const {test}=require('node:test');const assert=require('node:assert/strict');
const plain=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b,message)=>assert.deepEqual(plain(a),plain(b),message);
const fs=require('node:fs'),path=require('node:path');const {setup}=require('./lifecycle-fixture.cjs');
async function fixture(){const f=await setup();f.get(fs.readFileSync(path.join(__dirname,'..','exercise-catalog.js'),'utf8'));return {...f,catalog:f.get('ExerciseCatalog')};}
test('catalog rename and intrinsic metadata candidate preserve stable IDs and every workout fact',async()=>{
  const f=await fixture(),base=structuredClone(f.handle),row=base.document.catalog.exercises[0];
  const result=f.catalog.prepare(base,'editCatalogExercise',[{exerciseId:row.id,displayName:'Explicit renamed exercise',primary:'User category',equipment:'Cable',secondary:['User secondary']}]);
  assert.equal(result.candidate.document.catalog.exercises[0].id,row.id);
  equal(result.candidate.document.data,base.document.data);
  assert.equal(f.identity.resolveLabel(result.candidate.document.catalog,row.displayName),row.id);
  assert.equal(f.identity.resolveLabel(result.candidate.document.catalog,'Explicit renamed exercise'),row.id);
  equal(base,f.handle);
  const projected=f.repository.project(result.candidate.document,f.owner,f.bodyweightIds);
  const rebuilt=f.repository.assemble(projected,f.owner);
  assert.equal(rebuilt.document.catalog.exercises.find(e=>e.id===row.id).displayName,'Explicit renamed exercise');
});
test('alias and archive candidates are detached and collisions reject',async()=>{
  const f=await fixture(),row=f.document.catalog.exercises[0],other=f.document.catalog.exercises[1];
  const result=f.catalog.prepare(f.handle,'addCatalogAlias',[{exerciseId:row.id,label:'Explicit alternate label'}]);
  assert.equal(f.identity.resolveLabel(result.candidate.document.catalog,'Explicit alternate label'),row.id);
  assert.equal(f.identity.resolveLabel(f.handle.document.catalog,'Explicit alternate label'),null);
  assert.throws(()=>f.catalog.prepare(f.handle,'addCatalogAlias',[{exerciseId:row.id,label:other.displayName}]));
  const archived=f.catalog.prepare(f.handle,'editCatalogExercise',[{exerciseId:row.id,displayName:row.displayName,state:'archived'}]);
  assert.equal(f.catalog.selectable(archived.candidate.document.catalog,row.id),false);
  equal(archived.candidate.document.data,f.handle.document.data);
});
test('approved identity-v2 merge retains the source and exact original facts; v1 readers refuse it',async()=>{
  const f=await fixture(),base=structuredClone(f.handle),notes=new Set(base.document.data.noteScopes.exercise.map(n=>n.exercise.exerciseId));
  const candidates=base.document.catalog.exercises.filter(e=>!notes.has(e.id));
  const [source,target]=candidates;
  assert(source&&target);
  const result=f.catalog.prepare(base,'mergeCatalogExercises',[{exerciseId:source.id,targetId:target.id,confirmed:true,keepNameAlias:true}]);
  assert.equal(result.candidate.document.identityVersion,2);
  assert.equal(f.identity.resolveLabel(result.candidate.document.catalog,source.displayName),target.id);
  assert.equal(result.candidate.document.catalog.exercises.find(e=>e.id===source.id).state,'archived');
  equal(f.identity.restoreV2Source(result.candidate.document),f.identity.restoreV2Source(base.document));
  assert.throws(()=>f.identity.restoreV2Source({...result.candidate.document,identityVersion:1}),/Canonical display name/);
  equal(base,f.handle,'rejected candidate changes no committed or caller-owned data');
});
