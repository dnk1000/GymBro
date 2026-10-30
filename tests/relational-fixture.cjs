// Explicitly synthetic records. No browser/hosted credentials or Production data.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
function runtime() {
  const context = vm.createContext({ structuredClone,crypto:webcrypto,TextEncoder });
  for(const file of ["seed.js","workout-data.js","workout-sessions.js","guided-workouts.js","performance-context.js","workout-actions.js","exercise-identity.js","workout-concurrency.js","workout-repository.js"])
    vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context,{filename:file});
  const get=name=>vm.runInContext(name,context);
  return { get, repository:get("WorkoutRepository"), identity:get("ExerciseIdentity") };
}
async function fixture() {
  const r=runtime();
  let data=r.get("migrateData")(r.get("seed"));
  data.sets=[]; data.sessions=[]; data.bodyweights=[]; data.imports=[];
  data.activeSessionId=null; data.preferences={ "Smith Press":"legacy text; scope not inferred" };
  data.noteScopes={session:[],exerciseSession:[],exercise:[],legacyValue:{unknown:"  preserve\n"}};
  data.extension={zero:0,uncertain:false,empty:null,text:"literal \\u0000; emoji 🚀"};
  let seq=0;
  const actions=r.get("createWorkoutActions")({getState:()=>data,setState:x=>{data=x;},persist:()=>({ok:true}),createId:()=>`synthetic-${++seq}`,now:()=>"2026-10-28T04:00:00.000Z"});
  const requireOK=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result;};
  const sessionId=requireOK(actions.startGuidedSession({date:"2026-10-28",templateId:"push",duration:60})).sessionId;
  requireOK(actions.logGuidedSet({sessionId,planSlotId:"slot-1",expectedRevision:0,requestId:"request-a",weight:10,reps:8,notes:"  exact\n🚀 ",rir:0}));
  requireOK(actions.substituteGuidedExercise({sessionId,planSlotId:"slot-1",expectedRevision:1,exercise:"Bench Press"}));
  const logged=requireOK(actions.logGuidedSet({sessionId,planSlotId:"slot-1",expectedRevision:2,requestId:"request-b",weight:20,reps:8}));
  requireOK(actions.deleteSet(logged.setId));
  requireOK(actions.logSet({date:"2026-10-28",exercise:"Bench Press",weight:0,reps:null,unit:"assist lb",complete:false,sessionId:null}));
  requireOK(actions.logSet({date:"2026-10-28",exercise:"Bench Press",weight:10,reps:9,sessionId,planSlotId:"slot-1"}));
  requireOK(actions.saveScopedNote({scope:"session",sessionId,text:"  hotel gym\n",expectedText:""}));
  for(const planSlotId of ["slot-1",null]) requireOK(actions.saveScopedNote({scope:"exerciseSession",sessionId,exercise:"Bench Press",planSlotId,text:"occurrence "+planSlotId,expectedText:""}));
  requireOK(actions.saveScopedNote({scope:"exercise",exercise:"Bench Press",text:"  setup\n",expectedText:""}));
  data.sessions[0].setIds.reverse();
  data.sessions[0].notes="unclassified legacy session text";
  data.sessions[0].planSnapshot.slots[0].unknown={keep:true};
  data.bodyweights=[{date:"2026-10-28",value:200,note:"approximate"},{date:"2026-10-28",value:200,source:null}];
  data.imports=[{importId:"synthetic-import",date:"2026-10-28",setCount:0,notes:"summary, not session context",batch:"synthetic",unknown:[0,false]}];
  data.sets[0].unknown={nested:[0,false,null]};
  delete data.sets[0].rpe; // accepted optional omission differs from null
  const document=await r.identity.migrateV2(data);
  return {...r,source:data,document,bodyweightIds:["synthetic-bw-a","synthetic-bw-b"],sessionId,owner:"99999999-9999-4999-8999-999999999939"};
}
module.exports={runtime,fixture};
