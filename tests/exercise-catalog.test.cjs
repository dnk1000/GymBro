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
test('excluded matching label remains valid historical provenance and complete backups retain both formats',async()=>{
  const f=await fixture(),source=f.document.catalog.exercises.find(e=>e.displayName==='Bench Press'),target=f.document.catalog.exercises.find(e=>e.displayName==='Smith Press');
  const {candidate}=f.catalog.prepare(f.handle,'mergeCatalogExercises',[{exerciseId:source.id,targetId:target.id,confirmed:true,keepNameAlias:false}]);
  assert.equal(f.identity.resolveLabel(candidate.document.catalog,source.displayName),null);
  assert(candidate.document.catalog.aliases.some(a=>a.label===source.displayName&&a.exerciseId===target.id));
  equal(f.identity.restoreV2Source(candidate.document),f.identity.restoreV2Source(f.document));
  const audit=candidate.document.catalog.exercises.find(e=>e.id===source.id).metadata.gymbroMerge;
  audit.operation=['mergeCatalogExercises','test-operation'];audit.mergedAt='2026-11-09T12:00:00.000Z';
  const rows=f.repository.project(candidate.document,f.owner,f.bodyweightIds),handle={...f.handle,...candidate,rows};
  const backup=f.lifecycle.backup(handle),parsed=await f.lifecycle.parse(JSON.stringify(backup),f.owner);
  assert.equal(backup.source.identityVersion,2);equal(parsed.document,candidate.document);
  const old=f.lifecycle.backup(f.handle);assert.equal(old.source.identityVersion,1);equal((await f.lifecycle.parse(JSON.stringify(old),f.owner)).document,f.document);
  assert.throws(()=>f.catalog.prepare(handle,'addCatalogAlias',[{exerciseId:target.id,label:source.displayName}]),/excluded/);
});
test('note collision and unconfirmed/self merge reject before any mutation; suggestions only describe candidates',async()=>{
  const f=await fixture(),source=f.document.catalog.exercises.find(e=>e.displayName==='Bench Press'),target=f.document.catalog.exercises.find(e=>e.displayName==='Smith Press');
  const base=structuredClone(f.handle);base.document.data.noteScopes.exercise.push({exercise:{exerciseId:target.id,originalLabel:target.displayName},text:'Destination setup'});
  const before=structuredClone(base);
  assert.throws(()=>f.catalog.prepare(base,'mergeCatalogExercises',[{exerciseId:source.id,targetId:target.id,confirmed:true,keepNameAlias:true}]),/conflicting/);equal(base,before);
  for(const input of [{exerciseId:source.id,targetId:source.id,confirmed:true,keepNameAlias:true},{exerciseId:source.id,targetId:target.id,confirmed:false,keepNameAlias:true}])assert.throws(()=>f.catalog.prepare(f.handle,'mergeCatalogExercises',[input]));
  const original=structuredClone(f.document.catalog);f.catalog.suggestions(f.document.catalog,source.id);equal(original,f.document.catalog);
});
