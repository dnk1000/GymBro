const {fixture}=require('./relational-fixture.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function storage() { const map=new Map(); return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}; }
function handle(f, revision='0') { return {initialized:true,protocolVersion:1,ownerId:f.owner,revision,document:f.document,bodyweightIds:f.bodyweightIds}; }
// Preserve #39's injected persistence tests while exercising the new packet
// projection and controller. SQL/security/concurrency have independent tests.
function makeActions(f,options) {
  const initial={...handle(f),...options.initial};
  const transport=f.repository.create({ownerId:f.owner,client:{}});
  let saved=initial;
  const repository=options.repository.prepare ? options.repository : {ownerId:f.owner,prepare:transport.prepare,
    load:async()=>saved,
    submit:async packet=> {
      const before=packet.base ? f.repository.assemble(packet.base,f.owner) : null;
      const candidate=f.repository.assemble(packet.next,f.owner);
      const value=await options.repository.commit(before,candidate);
      saved={...value,initialized:true,protocolVersion:1,ownerId:f.owner,revision:(BigInt(saved.revision)+1n).toString()};
      return {code:'OK',saved,result:packet.result,operationRevision:saved.revision};
    },
    resolve:async()=>{throw Error('No resolver in this persistence test');},
  };
  return f.repository.createActions({...options,initial,repository,recoveryStorage:options.recoveryStorage??storage()});
}
async function serverFixture() {
  const f=await fixture(); let saved=handle(f); const receipts=new Map(),calls=[];
  let fault=null;
  const envelope=()=>({protocolVersion:1,ownerId:f.owner,revision:saved.revision,rows:plain(f.repository.project(saved.document,f.owner,saved.bodyweightIds,saved.signatureSchemes))});
  const client={rpc:async(name,args)=> {
    calls.push({name,args:plain(args)});
    if(name==='gymbro_workout_snapshot') return {data:envelope()};
    const op=args.operation??args.packet.operation,key=JSON.stringify(op),receipt=receipts.get(key);
    let answer;
    if(receipt) answer=receipt.status==='cancelled'?{code:'CANCELLED'}:
      args.packet&&JSON.stringify(args.packet)!==receipt.signature?{code:'REQUEST_CONFLICT'}:
      {code:'REPLAY',result:receipt.result,operationRevision:receipt.revision};
    else if(name==='gymbro_workout_resolve') {receipts.set(key,{status:'cancelled'});answer={code:'CANCELLED'};}
    else if(args.packet.expectedRevision!==saved.revision) answer={code:'CONFLICT'};
    else {
      if(fault==='rollback') {fault=null;return {error:{code:'23514'}};}
      const packet=args.packet;
      saved={...f.repository.assemble(packet.next,f.owner),initialized:true,protocolVersion:1,ownerId:f.owner,revision:(BigInt(saved.revision)+1n).toString()};
      receipts.set(key,{status:'committed',signature:JSON.stringify(packet),result:packet.result,revision:saved.revision});
      answer={code:'OK',result:packet.result,operationRevision:saved.revision};
      if(fault==='lost') {fault=null;throw Error('Acknowledgement deliberately lost');}
    }
    return {data:{...answer,operation:op,snapshot:envelope()}};
  }};
  const repository=f.repository.create({client,ownerId:f.owner});
  const create=(options={})=>f.repository.createActions({initial:saved,repository,recoveryStorage:storage(),...options});
  return {...f,repository,client,create,calls,receipts,getSaved:()=>saved,setFault:value=>{fault=value;}};
}
module.exports={storage,handle,makeActions,serverFixture,plain};
