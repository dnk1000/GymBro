const storageState = { raw: null, blocked: false, stale: false, message: "" };
function load() {
  try {
    storageState.raw = localStorage.getItem(KEY);
    return storageState.raw === null
      ? migrateData(seed)
      : migrateData(JSON.parse(storageState.raw));
  } catch (error) {
    storageState.blocked = true;
    storageState.message = `Saved data could not be opened: ${error.message} The original has not been changed. Download it before restoring a backup or starting over.`;
    return emptyData();
  }
}
function persistData(next, recovery = false) {
  if (typeof cloudMode!=="undefined" && cloudMode) return {ok:false,errors:["Cloud mode cannot save to local workout storage."]};
  try {
    if ((storageState.blocked && !recovery) || storageState.stale)
      throw Error("Saving is paused. Resolve the storage notice first.");
    const current = localStorage.getItem(KEY);
    if (current !== storageState.raw) {
      storageState.stale = true;
      throw Error(
        "Another tab changed your data. Export this tab if needed, then reload before editing.",
      );
    }
    validateData(next);
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    storageState.raw = raw;
    storageState.blocked = false;
    storageState.message = "";
    return { ok: true };
  } catch (error) {
    storageState.message = `Changes were not saved. ${error.message} Your previously saved data is unchanged. Export a backup if storage is full or unavailable.`;
    return { ok: false, errors: [storageState.message] };
  }
}
// Legacy UI adapter for backup/restore/reset paths not extracted in Milestone 1.
function save(next, recovery = false) {
  const result = persistData(next, recovery);
  renderStorageNotice();
  if (!result.ok) alert(result.errors.join("\n"));
  return result.ok;
}
function renderStorageNotice() {
  if (typeof cloudMode!=="undefined" && cloudMode) return;
  const notice = document.getElementById("storageNotice");
  notice.hidden = !storageState.message;
  document.getElementById("storageMessage").textContent = storageState.message;
  document.getElementById("recoverStorage").hidden =
    !storageState.blocked || storageState.stale;
}
function downloadStoredData() {
  if (storageState.raw === null) {
    alert("No stored data is available to download.");
    return;
  }
  download("gymbro-original-data.json", "application/json", storageState.raw);
}
function recoverStorage() {
  if (typeof cloudMode!=="undefined" && cloudMode) return;
  if (
    !confirm(
      "Replace the unreadable saved data with an empty workout history? Download the original first.",
    )
  )
    return;
  const next = emptyData();
  if (save(next, true)) {
    db = next;
    clearInbox();
    renderAll();
  }
}
window.addEventListener("storage", (event) => {
  if (typeof cloudMode!=="undefined" && cloudMode) return;
  if (
    event.storageArea === localStorage &&
    (event.key === KEY || event.key === null)
  ) {
    storageState.stale = true;
    storageState.message =
      "Another tab changed your data. Export this tab if needed, then reload before editing.";
    renderStorageNotice();
  }
});

// Safari may restore a suspended page without delivering a storage event.
// Recheck on return, but never reload/adopt data or save transient inputs here.
function checkStoredDataOnResume() {
  if (typeof cloudMode!=="undefined" && cloudMode) return;
  if (
    document.visibilityState !== "visible" ||
    storageState.blocked ||
    storageState.stale
  )
    return;
  try {
    if (localStorage.getItem(KEY) !== storageState.raw) {
      storageState.stale = true;
      storageState.message =
        "Another tab changed your data. Export this tab if needed, then reload before editing.";
      renderStorageNotice();
    }
  } catch {
    storageState.stale = true;
    storageState.message =
      "Saved data could not be checked. Saving is paused. Keep this tab open, export a backup if possible, and reload when browser storage is available. Unsaved form values have not been saved.";
    renderStorageNotice();
  }
}
window.addEventListener("pageshow", checkStoredDataOnResume);
document.addEventListener("visibilitychange", checkStoredDataOnResume);
