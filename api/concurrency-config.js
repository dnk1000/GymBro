// Synthetic test infrastructure only. Independent, explicit branch-Preview flag.
const {probeConfig}=require('./supabase-probe-config.js');
function concurrencyConfig(env) {
  if(env.GYMBRO_CONCURRENCY_TEST!=='true') return {enabled:false};
  const config=probeConfig({...env,GYMBRO_SUPABASE_PROBE:'true'});
  if(!config.enabled || !config.configured) return config;
  const owners=(env.GYMBRO_CONCURRENCY_TEST_OWNERS??'').split(',');
  const fixtureTag=env.GYMBRO_CONCURRENCY_FIXTURE_TAG;
  if(owners.length<1 || owners.length>4 || !owners.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) || !/^gymbro-issue40-[a-z0-9-]+$/.test(fixtureTag??''))
    return {enabled:true,configured:false,message:'Dedicated synthetic owners and fixture tag are required.'};
  return {...config,allowedOwners:owners,fixtureTag};
}
function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json(concurrencyConfig(process.env));
}
module.exports=handler;module.exports.concurrencyConfig=concurrencyConfig;
