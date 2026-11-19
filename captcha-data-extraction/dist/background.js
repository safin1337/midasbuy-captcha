let openingControls;
function openControls(tab) {
  if (!openingControls) openingControls = openControlWindow(tab).finally(()=>{openingControls=null;});
  return openingControls;
}
async function openControlWindow(tab) {
  if (!tab.id || !/^https?:/.test(tab.url || '')) return;
  const {controlWindow} = await chrome.storage.session.get('controlWindow');
  if (controlWindow) {
    try {
      const existing=await chrome.windows.get(controlWindow,{populate:true});
      if (existing.tabs?.some(t=>(t.url || t.pendingUrl || '').startsWith(chrome.runtime.getURL('index.html')))) {
        await chrome.windows.update(controlWindow,{focused:true}); return existing;
      }
    } catch { /* Already closed. */ }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`index.html?tab=${tab.id}`),
    type: 'popup', width: 460, height: 790,
  });
  await chrome.storage.session.set({controlWindow:win.id,targetTab:tab.id});
  return win;
}
chrome.action.onClicked.addListener(tab=>{openControls(tab).catch(error=>console.error('Could not open capture controls:',error.message));});
chrome.windows.onRemoved.addListener(async id => {
  const {controlWindow,targetTab} = await chrome.storage.session.get(['controlWindow','targetTab']);
  if (id !== controlWindow) return;
  const {lastRun}=await chrome.storage.local.get('lastRun');
  if (lastRun?.state==='running') await chrome.storage.local.set({lastRun:{...lastRun,state:'interrupted',message:'Control window closed during capture.',updatedAt:Date.now()}});
  if (targetTab) await chrome.debugger.detach({tabId:targetTab}).catch(()=>{});
  await chrome.storage.session.remove(['controlWindow','targetTab']);
});
