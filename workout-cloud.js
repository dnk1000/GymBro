// One #40 controller owns ordinary actions, migration and #41 lifecycle state.
const WorkoutCloud = (() => {
  function create({client,ownerId,initial,recoveryStorage,fixtureTag,sourceGuard,onChange=()=>{}}) {
    const domain=WorkoutRepository.create({client,ownerId});
    // The lifecycle decoder includes raw-state qualification and all recovery keys.
    const transport={rpc:(name,args)=>client.rpc(name==='gymbro_lifecycle_mutate' && args.packet.action==='initializeMigration'?
      'gymbro_migration_initialize':name,args)};
    const lifecycle=WorkoutLifecycle.createRepository({client:transport,ownerId});
    const repository={ownerId,load:lifecycle.load,resolve:lifecycle.resolve,
      prepare:(base,next,context)=>['initializeMigration','restoreCompleteBackup','mergeHistoryBackup'].includes(context.action)?
        lifecycle.prepare(base,next,context):domain.prepare(base,next,context),
      submit:async packet=>{
        const reply=await (['initializeMigration','restoreCompleteBackup','mergeHistoryBackup'].includes(packet.action)?lifecycle:domain).submit(packet);
        // An ordinary acknowledgement is protocol-compatible; qualify it through
        // the same authoritative lifecycle read before publishing a healthy view.
        if(reply.saved && !reply.saved.status) {
          const loaded=await lifecycle.load();
          if(BigInt(loaded.revision)<BigInt(reply.saved.revision))throw Error('Older cloud snapshot.');
          reply.saved=loaded;
        }
        return reply;
      }};
    let controller;
    async function prepare(base,name,args) {
      if(['initializeMigration','restoreCompleteBackup','mergeHistoryBackup'].includes(name)) {
        if(sourceGuard)await sourceGuard(args[0].text);
        if(fixtureTag){const incoming=await WorkoutLifecycle.parse(args[0].text,ownerId);if(incoming.document.data.extension?.previewMigrationFixture!==fixtureTag)throw Error('Configured synthetic fixtures only.');}
        return name==='initializeMigration'?WorkoutMigration.prepareAction(base,name,args):WorkoutLifecycle.prepareAction(base,name,args);
      }
      if(['restoreCompleteBackup','mergeHistoryBackup'].includes(name))return WorkoutLifecycle.prepareAction(base,name,args);
      if(base.status!=='healthy')throw Error('Healthy cloud data required.');
      // Exact labels at free-text input boundaries become canonical IDs. Only
      // accepted manual/import creation paths may allocate a new exercise.
      const working=structuredClone(base),catalog=()=>working.document.catalog;
      const resolve=(input,allowNew)=>{
        if(!input || typeof input.exercise!=='string')return;
        if(catalog().exercises.some(e=>e.id===input.exercise))return;
        const label=input.exercise;let id=ExerciseIdentity.resolveLabel(catalog(),label);
        if(!id && allowNew) {
          const temporary={exerciseLibrary:{}};ensureExercise(temporary,label);const meta=temporary.exerciseLibrary[label];
          working.document.catalog=ExerciseIdentity.createExercise(catalog(),{displayName:label,provenance:name==='commitImport'?'import-created':'user-created',metadata:meta,...meta});
          id=ExerciseIdentity.resolveLabel(catalog(),label);
          working.document.legacyExerciseLibrary[label]=structuredClone(meta);
        }
        if(!id)throw Error('Resolve an exact exercise label first.');
        input.exercise=id;input.originalLabel=label;
      };
      for(const arg of args)resolve(arg,['logSet','editSet','addSlot'].includes(name));
      if(name==='commitImport')for(const row of args[0].sets.filter(r=>r.include))resolve(row,true);
      return WorkoutRepository.prepareAction(working,name,args,{createId:()=>crypto.randomUUID()});
    }
    controller=WorkoutConcurrency.create({initial,repository,recoveryStorage,prepare});
    const call=async(method,...args)=>{const operation=method==='execute'?({initializeMigration:'migration',restoreCompleteBackup:'restore',mergeHistoryBackup:'merge'}[args[0]]??'save'):method==='refresh'?'refresh':'resolution';const pending=controller[method](...args);onChange(facade,undefined,operation);const result=await pending;onChange(facade,result,operation);return result;};
    const facade=Object.freeze({...controller,execute:(...args)=>call('execute',...args),refresh:()=>call('refresh'),retry:()=>call('retry'),resolve:()=>call('resolve')});
    return facade;
  }
  return Object.freeze({create});
})();
