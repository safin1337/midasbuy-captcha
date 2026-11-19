import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import {loadDestinations, storedDestinations, describeDestination, createSequentialSaver} from './files.mjs';
import {watchImageLoads} from './loading.mjs';
import {collect} from './core.mjs';
import {calibrate, createBrowserCapture, installEscape, removeEscape} from './browser.mjs';
import './index.css';
import './app.css';

function App() {
  const tabId = Number(new URLSearchParams(location.search).get('tab'));
  const [format,setFormat] = useState('B');
  const [destinations,setDestinations] = useState({});
  const [foldersLoaded,setFoldersLoaded] = useState(false);
  const [configs,setConfigs] = useState({});
  const [busy,setBusy] = useState(false);
  const [running,setRunning] = useState(false);
  const [status,setStatus] = useState('Ready for 10 images.');
  const [error,setError] = useState(false);
  const [completed,setCompleted] = useState(0);
  const [preview,setPreview] = useState('');
  const [target,setTarget] = useState('');
  const controller = useRef(null);
  const config = configs[format];
  const destination = destinations[format];
  const folder = destination?.handle;
  const prerequisite = !tabId ? 'Open this extension from the CAPTCHA tab.' : !folder ? 'Choose the folder where photos will be saved.' : !config ? 'Mark the capture area.' : null;
  const visibleStatus = !busy && !error && prerequisite ? prerequisite : status;
  useEffect(() => {
    loadDestinations().then(setDestinations).catch(e=>fail(e)).finally(()=>setFoldersLoaded(true));
    chrome.storage.local.get('areas').then(v=>setConfigs(v.areas || {}));
    chrome.storage.local.get('lastRun').then(async({lastRun})=>{
      if (lastRun?.version!==chrome.runtime.getManifest().version) return;
      if (lastRun?.tabId===tabId && lastRun.state==='running') {
        const locks=await navigator.locks.query();
        if (!locks.held.some(lock=>lock.name==='captcha-data-extraction-run')) {
          lastRun={...lastRun,state:'interrupted',message:`Previous capture ended before completion. ${lastRun.saved || 0} of 10 images saved.`,updatedAt:Date.now()};
          await chrome.storage.local.set({lastRun});
        }
      }
      if (lastRun?.tabId===tabId && ['error','interrupted'].includes(lastRun.state)) {
        setCompleted(lastRun.saved || 0); fail(new Error(lastRun.message));
      }
    }).catch(e=>fail(e));
    if (tabId) chrome.tabs.get(tabId).then(t=>setTarget(new URL(t.url).hostname)).catch(()=>fail(new Error('Target tab closed. Open the extension from the CAPTCHA tab.')));
    const stop = message => { if (message.type === 'stop-capture') controller.current?.abort(); };
    const detached = (source,reason) => {
      if (source.tabId === tabId) controller.current?.abort(new Error(`Chrome disconnected capture (${reason || 'connection ended'}). Reopen the extension from the CAPTCHA tab.`));
    };
    const key = e => { if (e.key === 'Escape') controller.current?.abort(); };
    chrome.runtime.onMessage.addListener(stop);
    chrome.debugger.onDetach.addListener(detached);
    window.addEventListener('keydown',key);
    return () => { controller.current?.abort(); chrome.runtime.onMessage.removeListener(stop); chrome.debugger.onDetach.removeListener(detached); window.removeEventListener('keydown',key); };
  },[]);
  useEffect(()=>()=> { if (preview) URL.revokeObjectURL(preview); },[preview]);
  function fail(e) { setError(true); setStatus(e.message || String(e)); }
  async function chooseFolder() {
    setBusy(true);
    try {
      const handle = await showDirectoryPicker({id:`captcha-output-${format}`,mode:'readwrite',...(folder ? {startIn:folder} : {})});
      const next = {...destinations,[format]:{handle,visiblePath:await describeDestination(handle)}};
      await storedDestinations(next); setDestinations(next); setError(false);
      setStatus(config ? 'Ready for 10 images.' : 'Folder selected. Mark the capture area for this format.');
    } catch(e) { if (e.name !== 'AbortError') fail(e); }
    finally { setBusy(false); }
  }
  async function mark() {
    setBusy(true); setError(false);
    setStatus('On the CAPTCHA tab: draw the box, then click the reload button. Escape cancels.');
    try {
      const result = await calibrate(tabId);
      if (result) {
        const next = {...configs,[format]:result};
        await chrome.storage.local.set({areas:next}); setConfigs(next);
        setStatus(folder ? 'Area and reload point saved. Ready for 10 images.' : 'Area saved. Choose the folder where photos will be saved.');
      } else setStatus('Area selection cancelled.');
      const win = await chrome.windows.getCurrent(); await chrome.windows.update(win.id,{focused:true});
    } catch(e) { fail(e); }
    finally { setBusy(false); }
  }
  async function start() {
    setBusy(true); setRunning(true); setError(false); setCompleted(0);
    const abort = new AbortController(); controller.current = abort;
    let attached = false, saved = 0, loading;
    let persistence=Promise.resolve();
    let record={id:crypto.randomUUID(),version:chrome.runtime.getManifest().version,tabId,format,state:'running',saved:0,updatedAt:Date.now()};
    const remember=changes=>{
      record={...record,...changes,updatedAt:Date.now()};
      const value={...record};
      persistence=persistence.then(()=>chrome.storage.local.set({lastRun:value})).catch(()=>{});
    };
    remember({step:'starting'});
    try {
      if (!folder || !config) throw new Error('Choose a save folder and mark the capture area first.');
      if (await folder.requestPermission({mode:'readwrite'}) !== 'granted') throw new Error('Folder write permission was not granted. Choose the folder again.');
      await navigator.locks.request('captcha-data-extraction-run',{ifAvailable:true},async lock => {
        if (!lock) throw new Error('Another capture run is active. Stop it before starting this run.');
        const save = await createSequentialSaver(folder,abort.signal);
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId,{active:true});
        await chrome.windows.update(tab.windowId,{focused:true});
        await chrome.scripting.executeScript({target:{tabId},func:installEscape});
        await chrome.debugger.attach({tabId},'1.3'); attached = true;
        await new Promise(resolve=>setTimeout(resolve,300));
        loading = watchImageLoads(tabId);
        await loading.prepare();
        const browser = createBrowserCapture(tabId,config,loading);
        setStatus('Capturing 0 of 10. Escape on either window stops the run.');
        await collect({signal:abort.signal,snapshot:browser.snapshot,click:()=>browser.click(abort.signal),
          phase:detail=>{
            remember(detail);
            if (detail.step==='waiting' && detail.elapsedMs>=5000) setStatus(`Waiting for image ${detail.image} of 10 (${Math.floor(detail.elapsedMs/1000)}s).`);
          },
          pause:(ms,signal)=>new Promise((resolve,reject)=>{
            if (signal.aborted) return reject(signal.reason || new DOMException('Stopped by user.','AbortError'));
            const stop=()=>{clearTimeout(timer);reject(signal.reason || new DOMException('Stopped by user.','AbortError'));};
            const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);
            signal.addEventListener('abort',stop,{once:true});
          }),
          save,
          progress:(count,name,blob)=>{ saved=count;remember({step:'saved',saved:count,lastSaved:name});setCompleted(count);setPreview(URL.createObjectURL(blob));setStatus(`Saved ${name} · ${count} of 10`); },
        });
        setStatus('Complete. Saved 10 images. Start again for another batch.');
        remember({state:'complete',message:'Saved 10 images.'});
      });
    } catch(e) {
      if (e.name === 'AbortError') { const message=`Stopped. ${saved} of 10 images saved.`;remember({state:'stopped',message});setError(false);setStatus(message); }
      else { const message=`${e.message} (${saved} of 10 saved.)`;remember({state:'error',message});fail(new Error(message)); }
    } finally {
      controller.current = null;
      loading?.dispose();
      if (attached) await chrome.debugger.detach({tabId}).catch(()=>{});
      await chrome.scripting.executeScript({target:{tabId},func:removeEscape}).catch(()=>{});
      controller.current = null; setBusy(false);setRunning(false);
      await persistence;
    }
  }
  return <main>
    <header><h1>Captcha Data Extraction</h1><p>10 images per run.</p></header>
    <Card className="panel" role="region" aria-label="Capture settings">
      <label htmlFor="format">Format</label>
      <select id="format" value={format} disabled={busy || !foldersLoaded} onChange={e=>{setFormat(e.target.value);setCompleted(0);setPreview('');setError(false);setStatus('Check the area for this format before starting.');}}>
        <option value="A">Format A (Slider)</option><option value="B">Format B (selector)</option>
      </select>
      <div className="folder-row"><Button variant="outline" disabled={busy || !foldersLoaded} onClick={chooseFolder}>{folder ? 'Change folder' : 'Choose folder'}</Button></div>
      <p className="path">Currently Selected: {folder ? `[Hidden by Chrome]\\${destination.visiblePath || folder.name}` : 'No folder selected'}</p>
      <Button className="area-button" variant="outline" disabled={busy || !tabId} onClick={mark}>{config ? 'Adjust capture area' : 'Mark capture area'}</Button>
      {config && <p className="area-detail">{config.rect.width} × {config.rect.height} pixels</p>}
    </Card>
    <Card className="panel" role="region" aria-label="Capture run">
      <div className="actions">{running ? <Button onClick={()=>controller.current?.abort()}>Stop</Button> : <Button disabled={busy || !folder || !config || !tabId} onClick={start}>Start 10 captures</Button>}</div>
      <progress aria-label="Images saved" value={completed} max="10" />
      <p className={error ? 'status error' : 'status'} role={error ? 'alert' : 'status'}>{visibleStatus}</p>
      {preview && <img className="preview" src={preview} alt="Last saved CAPTCHA screenshot" />}
    </Card>
    {target && <p className="target">{target}</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
