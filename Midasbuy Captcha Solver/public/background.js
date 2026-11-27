let openingControls;
let solverInputMemory;
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
chrome.action.onClicked.addListener(tab=>{openControls(tab).catch(error=>console.error('Could not open solver controls:',error.message));});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (message.type==='solver-pointer-position' && sender.url?.startsWith(chrome.runtime.getURL('index.html'))) {
    if (solverInputMemory?.held && solverInputMemory.tabId===message.tabId) solverInputMemory={...solverInputMemory,point:message.point};
    respond({ok:true});return;
  }
  if (message.type!=='solver-input-state' || !sender.url?.startsWith(chrome.runtime.getURL('index.html'))) return;
  chrome.storage.session.get('targetTab').then(async({targetTab})=>{
    if (message.tabId!==targetTab) throw new Error('Wrong target tab');
    solverInputMemory={tabId:targetTab,held:!!message.held,point:message.point};
    await chrome.storage.session.set({solverInput:solverInputMemory});
    respond({ok:true});
  }).catch(()=>respond({ok:false}));
  return true;
});
chrome.windows.onRemoved.addListener(async id => {
  const {controlWindow,targetTab} = await chrome.storage.session.get(['controlWindow','targetTab']);
  if (id !== controlWindow) return;
  const saved=await chrome.storage.session.get('solverInput');
  const solverInput=solverInputMemory || saved.solverInput;
  if (solverInput?.held && solverInput.tabId===targetTab && solverInput.point) {
    await chrome.debugger.sendCommand({tabId:targetTab},'Input.dispatchMouseEvent',{
      type:'mouseReleased',x:solverInput.point.x,y:solverInput.point.y,button:'left',buttons:0,clickCount:1,
    }).catch(()=>{});
  }
  await chrome.storage.session.remove('solverInput');
  solverInputMemory=null;
  if (targetTab) await chrome.debugger.detach({tabId:targetTab}).catch(()=>{});
  await chrome.storage.session.remove(['controlWindow','targetTab']);
});
