const fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./relational-fixture.cjs');
async function setup(){const f=await fixture();for(const file of ['app-version.js','workout-lifecycle.js'])f.get(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  const lifecycle=f.get('WorkoutLifecycle'),rows=f.repository.project(f.document,f.owner,f.bodyweightIds);
  const handle={document:f.document,bodyweightIds:f.bodyweightIds,rows,status:'healthy',initialized:true,protocolVersion:1,ownerId:f.owner,revision:'12',fingerprint:'a'.repeat(64),signatureSchemes:{}};
  return {...f,lifecycle,handle};}
module.exports={setup};
