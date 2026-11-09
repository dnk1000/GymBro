// One catalog editor in the existing canonical exercise detail surface.
let catalogDraft = null;
function renderCatalogDetail(id) {
  if(!cloudMode || !cloudController)return '';
  const handle=cloudController.getSnapshot(),catalog=handle.document.catalog,row=catalog.exercises.find(e=>e.id===id);
  if(!row)return '';
  if(row.metadata.gymbroMerge) {
    const audit=row.metadata.gymbroMerge;
    return `<div class="notice">Merged into ${esc(audit.targetName)} on ${esc(audit.mergedAt || 'pending')}. Original identity and provenance retained.</div>`;
  }
  const draft=catalogDraft?.exerciseId===id?catalogDraft:null;
  const value=key=>esc(draft?.[key]??(key==='secondary'?row.secondary.join(', '):row[key]));
  const aliases=catalog.aliases.filter(a=>a.exerciseId===id).map(a=>a.label);
  const options=catalog.exercises.filter(e=>e.id!==id&&!e.metadata.gymbroMerge);
  const suggestions=ExerciseCatalog.suggestions(catalog,id);
  return `<details class="catalog-editor"><summary>Manage exercise</summary>
    <p class="sub">Name, aliases and catalog metadata do not change recorded workout facts. Template roles and short-plan inclusion stay in Program.</p>
    <label>Display name<input id="catalogName" value="${value('displayName')}"></label>
    <label>Primary group<input id="catalogPrimary" value="${value('primary')}"></label>
    <label>Secondary groups (comma separated)<input id="catalogSecondary" value="${value('secondary')}"></label>
    <label>Movement pattern<input id="catalogPattern" value="${value('pattern')}"></label>
    <label>Equipment<input id="catalogEquipment" value="${value('equipment')}"></label>
    <label>Type<input id="catalogType" value="${value('type')}"></label>
    <label>Availability<select id="catalogState"><option value="active" ${value('state')==='active'?'selected':''}>Active</option><option value="archived" ${value('state')==='archived'?'selected':''}>Archived</option></select></label>
    <button type="button" onclick="saveCatalogExercise()">Save catalog changes</button>
    <p class="sub">Aliases: ${aliases.map(esc).join(' · ')}</p>
    <label>New exact alias<input id="catalogAlias" value="${esc(draft?.alias??'')}"></label><button type="button" onclick="saveCatalogAlias()">Add alias</button>
    <details><summary>Merge exercises</summary><p>Move this exercise's references to a destination you choose. Recorded values, original labels and session intent are preserved. Conflicting notes must be resolved first.</p>
    ${suggestions.length?`<p class="sub">Possible duplicates, for review only: ${suggestions.map(e=>esc(e.displayName)).join(' · ')}. Similar names do not establish equivalence.</p>`:''}
    <label>Destination<select id="catalogTarget"><option value="">Choose destination</option>${options.map(e=>`<option value="${esc(e.id)}">${esc(e.displayName)}${e.state==='archived'?' (archived)':''}</option>`).join('')}</select></label>
    <label class="checkline"><input type="checkbox" id="catalogKeepName" checked>Keep the old name as a matching alias</label>
    <button type="button" class="btn danger" onclick="reviewCatalogMerge()">Review merge</button></details>
    <p id="catalogStatus" role="status" aria-live="polite"></p></details>`;
}
function captureCatalogDraft() {
  const read=id=>document.getElementById(id).value;
  catalogDraft={exerciseId:selectedExercise,displayName:read('catalogName'),primary:read('catalogPrimary'),secondary:read('catalogSecondary'),pattern:read('catalogPattern'),equipment:read('catalogEquipment'),type:read('catalogType'),state:read('catalogState'),alias:read('catalogAlias')};
  return catalogDraft;
}
async function runCatalogAction(action,input) {
  const status=document.getElementById('catalogStatus');
  try {
    const result=await cloudController.execute(action,input);
    if(!result.ok){if(status?.isConnected)status.textContent=result.errors.join(' ')||'Catalog change was rejected. Resolve conflicting notes or labels, then review again.';return;}
    catalogDraft=null;selectedExercise=result.exerciseId??selectedExercise;renderAll();
  }catch(error){if(status?.isConnected)status.textContent=error.message;}
}
function saveCatalogExercise() {const draft=captureCatalogDraft();const {alias,...input}=draft;input.secondary=draft.secondary.split(',').map(s=>s.trim()).filter(Boolean);return runCatalogAction('editCatalogExercise',input);}
function saveCatalogAlias() {const draft=captureCatalogDraft();return runCatalogAction('addCatalogAlias',{exerciseId:selectedExercise,label:draft.alias});}
function reviewCatalogMerge() {
  captureCatalogDraft();
  const handle=cloudController.getSnapshot(),targetId=document.getElementById('catalogTarget').value,keepNameAlias=document.getElementById('catalogKeepName').checked;
  const input={exerciseId:selectedExercise,targetId,keepNameAlias,confirmed:true};
  try{
    ExerciseCatalog.prepare(handle,'mergeCatalogExercises',[input]);
    const source=handle.document.catalog.exercises.find(e=>e.id===selectedExercise),target=handle.document.catalog.exercises.find(e=>e.id===targetId);
    if(!confirm(`Merge ${source.displayName} (${source.id}) into ${target.displayName} (${target.id})?\nAll affected historical/template references move to the destination. The source is archived with audit provenance.\nOld name matching alias: ${keepNameAlias?'keep':'exclude'}. No automatic undo.`))return;
    if(cloudController.getSnapshot().revision!==handle.revision)throw Error('Saved catalog changed; refresh and review the merge again.');
    return runCatalogAction('mergeCatalogExercises',input);
  }catch(error){document.getElementById('catalogStatus').textContent=error.message;}
}
