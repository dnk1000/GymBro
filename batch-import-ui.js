// Presentation only. Persist through the same owner-bound lifecycle controller.
async function renderBatchDraft() {
  if(!batchDraft)return;
  const draft=batchDraft,generation=++batchReviewGeneration;commitInboxBtn.disabled=true;
  try{
    const base=cloudController?.getSnapshot();
    if(!base)throw Error('Connect cloud workouts before reviewing the batch.');
    const review=await BatchImport.review(base,draft.payload,{selected:draft.selected,resolutions:draft.resolutions});
    if(generation!==batchReviewGeneration||draft!==batchDraft)return;
    draft.review=review;draft.resolutions=review.resolutions;
    inboxStatus.textContent=`${review.units.length} workouts found; ${review.newCount} ready. ${review.errors.length?'Selected workouts need review; nothing will be saved until resolved or explicitly excluded.':'Review the selection, then confirm once.'}`;
    inboxMeta.innerHTML='<div class="notice">Batch import adds history only. Current program, preferences and active workout are kept. Complete history sources must represent one completed session or one sessionless date. Excluding a whole workout leaves its import ID available; excluded sets within an imported legacy workout require a separate future import with a new ID.</div>';
    const catalog=base.document.catalog;
    const labels={canonical:'Known',alias:'Saved alias',mapped:'Approved mapping',new:'Create new',unresolved:'Needs review',skipped:'Skip'};
    const groups=review.groups.map((g,i)=>{
      const d=draft.resolutions.find(d=>d.label===g.label),value=d?.kind==='map'?(d.plannedLabel!==undefined?'planned:'+d.plannedLabel:'map:'+d.exerciseId):d?.kind??'';
      const controls=g.status==='unresolved'||!!d;
      return `<div class="item" style="overflow-wrap:anywhere"><strong>${esc(g.label)}</strong>: ${esc(labels[g.status])}${g.displayName?' → '+esc(g.displayName):''}${g.error?'<div class="status-bad">'+esc(g.error)+'</div>':''}${controls?`<label class="label">Resolve exercise<select aria-label="Resolve batch exercise ${i+1}" data-batch-resolution="${i}">${[['','Choose resolution'],['create','Create new exercise'],['skip','Skip affected sets / whole historical workout'],...review.groups.filter(target=>target.status==='new'&&!target.error&&target.label!==g.label).map(target=>['planned:'+target.label,'Planned in this import: '+target.label]),...catalog.exercises.map(e=>['map:'+e.id,'Saved: '+e.displayName+(e.equipment?' · '+e.equipment:'')])].map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:''}</div>`;
    }).join('');
    inboxReview.innerHTML=review.units.map(u=>`<div class="item" style="overflow-wrap:anywhere"><label class="checkline"><input type="checkbox" aria-label="Select workout ${u.index+1}" data-batch-unit="${u.index}" ${draft.selected.includes(u.index)?'checked':''}>Workout ${u.index+1}: ${esc(u.date??'invalid date')}</label><div>${esc(u.sessionId??'Sessionless')} · ${u.refs ? new Set(u.refs.filter(r=>r.include).map(r=>r.exercise)).size : 0} exercise references · ${u.draft?.sets.length??u.history?.document.data.sets.length??0} sets</div><strong>${esc(u.status)}</strong><div>${esc(u.warning??'')}</div>${u.errors.map(error=>`<div class="status-bad">${esc(error)}</div>`).join('')}</div>`).join('')+`<h3>Resolve exceptions</h3>${groups}`;
    inboxReview.querySelectorAll('[data-batch-unit]').forEach(el=>el.onchange=()=>{const index=Number(el.dataset.batchUnit);draft.selected=el.checked?[...new Set([...draft.selected,index])]:draft.selected.filter(i=>i!==index);renderBatchDraft();});
    inboxReview.querySelectorAll('[data-batch-resolution]').forEach(el=>el.onchange=()=>{const label=review.groups[Number(el.dataset.batchResolution)].label;draft.resolutions=draft.resolutions.filter(d=>d.label!==label);if(el.value)draft.resolutions.push(el.value.startsWith('planned:')?{label,kind:'map',plannedLabel:el.value.slice(8)}:el.value.startsWith('map:')?{label,kind:'map',exerciseId:el.value.slice(4)}:{label,kind:el.value});renderBatchDraft();});
    commitInboxBtn.textContent='Confirm selected workouts';commitInboxBtn.disabled=review.errors.length>0||!review.newCount;
  }catch(error){if(generation===batchReviewGeneration){inboxStatus.textContent=error.message;commitInboxBtn.disabled=true;}}
}
function showBatchDisposition(rows) {
  inboxStatus.textContent=rows.map(r=>`Workout ${r.index+1} (${r.date??'unknown date'}): ${r.status}${r.count?' · '+r.count+' sets':''}`).join('; ');
}
async function commitBatchDraft() {
  const draft=batchDraft;if(!draft)return;
  const result=await cloudController.execute('mergeHistoryBackup',{batch:true,text:JSON.stringify(draft.payload),selected:draft.selected,resolutions:draft.resolutions,confirmed:true});
  if(!result.ok){
    if(['OUTCOME_UNKNOWN','PENDING','RECOVERY_PENDING'].includes(result.code)){
      showBatchDisposition((draft.review?.units??[]).map(u=>({index:u.index,date:u.date,status:u.status==='ready'?'outcome unknown':u.status})));
      inboxStatus.textContent+=' '+result.errors.join(' ');
    }else inboxStatus.textContent=result.errors.join(' ');
    return;
  }
  clearInbox(false);showBatchDisposition(result.batchDisposition??[]);
}
