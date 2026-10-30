// Operator-only exact branch Preview setup/cleanup. No Production target.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync,spawnSync}=require('node:child_process');
const {validate,project}=require('./issue41-staging-fixtures.cjs');
const {commandsFor}=require('./preview-db.cjs');
const root=path.resolve(__dirname,'..'),branch='codex/issue-41-lifecycle-contract';
const preview='https://gymbro-git-codex-issue-41-lifecycle-contract-dnk-9999.vercel.app';
const cli=process.env.GYMBRO_VERCEL_CLI_JS||(process.env.APPDATA&&path.join(process.env.APPDATA,'npm/node_modules/vercel/dist/index.js'));
function guard(){const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();commandsFor('apply',process.env,sha);
  assert.equal(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),branch);
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'');return sha;}
function command(args,input){const r=spawnSync(process.execPath,[cli,...args,'--scope','dnk-9999'],{cwd:root,input,encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw Error(`Branch Preview ${args.slice(0,2).join(' ')} failed; private CLI details withheld.`);return r.stdout;}
async function read(resource){if(!resource.startsWith('/')||resource.startsWith('//'))throw Error('Preview-relative path required.');
  return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[cli,'curl',resource,'--deployment',preview,'--scope','dnk-9999','--','--silent','--show-error','--fail'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const chunks=[];p.stdout.on('data',d=>chunks.push(d));p.on('error',()=>reject(Error('Preview read failed.')));p.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(Error('Authenticated Preview read failed.')));});}
async function main(){guard();const action=process.argv[2];if(process.argv.length!==3||!['configure','clear'].includes(action))throw Error('Choose configure or clear.');
  command(['link','--yes','--project','gymbro']);
  const names=['GYMBRO_LIFECYCLE_TEST','GYMBRO_LIFECYCLE_TEST_OWNERS','GYMBRO_LIFECYCLE_FIXTURE_TAG','GYMBRO_CLOUD_ENV','SUPABASE_PROJECT_REF','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
  if(action==='configure'){
    const state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue41-fixtures.json'),'utf8')));assert.equal(state.status,'ready');
    const values=['true',state.accounts.map(a=>a.id).join(','),state.tag,'preview',project,`https://${project}.supabase.co`,process.env.SUPABASE_PUBLISHABLE_KEY];
    if(!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(values[6]??''))throw Error('Staging public key required.');
    for(let i=0;i<names.length;i++)command(['env','add',names[i],'--environment','preview','--git-branch',branch,'--force','--yes'],values[i]+'\n');
  }else for(const name of names)command(['env','rm',name,'--environment','preview','--git-branch',branch,'--yes']);
  command(['redeploy',preview,'--environment','preview']);
  console.log(`Only ${names.length} Preview + ${branch} variables ${action==='configure'?'configured':'removed'}; branch redeployed. Production untouched.`);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={read,preview,guard};
