// #28 Preview capability. Login/Preview load never implies migration.
const {probeConfig}=require('./supabase-probe-config.js');
function workoutConfig(env) {
  if(env.GYMBRO_PREVIEW_WORKOUTS!=='true')return {enabled:false};
  const base=probeConfig({...env,GYMBRO_SUPABASE_PROBE:'true'});
  if(!base.enabled||!base.configured)return base;
  const fixtureTag=env.GYMBRO_PREVIEW_WORKOUT_FIXTURE_TAG;
  if(!/^gymbro-issue28-[a-z0-9-]+$/.test(fixtureTag??''))return {enabled:true,configured:false,message:'Synthetic fixture tag required.'};
  const allowedOwners=(env.GYMBRO_PREVIEW_WORKOUT_OWNERS??'').split(',');
  if(allowedOwners.length<1||allowedOwners.length>4||!allowedOwners.every(x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)))
    return {enabled:true,configured:false,message:'Explicit staging test owners required.'};
  return {...base,allowedOwners,fixtureTag,syntheticOnly:true};
}
function handler(req,res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json(workoutConfig(process.env));}
module.exports=handler;module.exports.workoutConfig=workoutConfig;
