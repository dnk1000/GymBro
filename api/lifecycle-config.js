// Explicit synthetic staging surface; disabled by default and in Production.
const {probeConfig}=require('./supabase-probe-config.js');
function lifecycleConfig(env) {
  if(env.GYMBRO_LIFECYCLE_TEST!=='true')return {enabled:false};
  const config=probeConfig({...env,GYMBRO_SUPABASE_PROBE:'true'});
  if(!config.enabled||!config.configured)return config;
  const allowedOwners=(env.GYMBRO_LIFECYCLE_TEST_OWNERS??'').split(','),fixtureTag=env.GYMBRO_LIFECYCLE_FIXTURE_TAG;
  if(allowedOwners.length<1||allowedOwners.length>4||!allowedOwners.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))||!/^gymbro-issue41-[a-z0-9-]+$/.test(fixtureTag??''))
    return {enabled:true,configured:false,message:'Dedicated synthetic owners and fixture tag required.'};
  return {...config,allowedOwners,fixtureTag};
}
function handler(req,res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json(lifecycleConfig(process.env));}
module.exports=handler;module.exports.lifecycleConfig=lifecycleConfig;
