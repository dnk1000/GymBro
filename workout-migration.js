// Deliberate Preview migration. Pure preparation/comparison; transport uses #40/#41.
const WorkoutMigration = (() => {
  const clone = x => structuredClone(x);
  const check = (x,m) => { if (!x) throw Error(m); };
  const canonical = x => Array.isArray(x) ? x.map(canonical) : isObject(x) ?
    Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])) : x;
  async function digest(text) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function prepareSource(text,ownerId) {
    const raw=JSON.parse(text); let normalized, keys;
    if(raw.format!=='gymbro-cloud-backup') {
      normalized=raw.version===DATA_VERSION ? (validateData(raw),clone(raw)) : migrateData(raw);
      const sourceDigest=await digest(JSON.stringify(canonical(normalized)));
      keys=await Promise.all(normalized.bodyweights.map(async(_,i)=>{
        const bytes=(await digest(JSON.stringify(['GymBro issue28 bodyweight v1',sourceDigest,i]))).slice(0,32).split('');
        bytes[12]='8';bytes[16]=((parseInt(bytes[16],16)&3)|8).toString(16);
        const s=bytes.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
      }));
      check(new Set(keys).size===keys.length,'Bodyweight identity collision.');
    }
    let i=0;
    const payload=await WorkoutLifecycle.parse(text,ownerId,{createBodyweightId:()=>keys[i++]});
    if(normalized) ExerciseIdentity.verifyV2Migration(normalized,payload.document);
    return {...payload,byteDigest:await digest(text),sourceDigest:await digest(JSON.stringify(canonical(normalized??raw))),
      sourceSchema:raw.format==='gymbro-cloud-backup'?raw.source.workoutVersion:raw.version??1,
      sourceBuild:typeof raw.appVersion==='string'?raw.appVersion:null};
  }
  function compare(candidate,saved,ownerId) {
    const expected=WorkoutRepository.project(candidate.document,ownerId,candidate.bodyweightIds,candidate.signatureSchemes);
    const actual=saved.document ? WorkoutRepository.project(saved.document,ownerId,saved.bodyweightIds,saved.signatureSchemes) : saved.rows;
    const tables=Object.keys(expected).map(table=>({table,fields:[...new Set(expected[table].flatMap(row=>Object.keys(row)))].sort(),expected:expected[table].length,actual:actual?.[table]?.length??null,
      pass:!!actual?.[table] && WorkoutLifecycle.equalRows({[table]:expected[table]},{[table]:actual[table]})}));
    return {format:'gymbro-migration-comparison',comparisonVersion:1,modelVersion:1,identityVersion:1,workoutVersion:8,
      protocolVersion:1,revision:saved.revision,method:'Complete canonical row equality: ownership, typed fields, presence/extension metadata, source positions and relationship keys; database row order is ignored.',transformations:candidate.kind==='legacy'?['Supported source normalized conservatively to workout schema 8; original raw file retained.','Exact exercise labels projected to stable canonical IDs with originalLabel provenance; no fuzzy merge.','Missing bodyweight keys allocated by the approved source-digest/ordinal UUIDv8 rule; identical rows stay distinct.','Guided signature bytes preserved with explicit interpretation metadata.']:['Canonical cloud identity, bodyweight keys and signature schemes preserved.'],pass:tables.every(t=>t.pass),tables};
  }
  async function prepareAction(base,name,args) {
    check(name==='initializeMigration' && args[0]?.confirmed===true,'Confirm migration first.');
    const candidate=await prepareSource(args[0].text,base.ownerId);
    if(base.status==='healthy') {
      check(compare(candidate,base,base.ownerId).pass,'Destination differs from the full canonical migration candidate. Use separately reviewed restore or merge.');
      return {result:{ok:true,code:'NO_CHANGE',errors:[],changes:[]}};
    }
    check(base.status==='uninitialized' && Object.values(base.rows).every(rows=>Array.isArray(rows)&&rows.length===0),
      'Migration requires an empty workout dataset and catalog.');
    return {candidate,result:{ok:true,code:'PREPARED',changes:['workoutData']}};
  }
  return Object.freeze({prepareSource,compare,prepareAction,digest});
})();
