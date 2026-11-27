import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {SolverPanel} from './SolverPanel';
import {calibrate} from './browser.mjs';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import './index.css';
import './app.css';

function App() {
  const tabId=Number(new URLSearchParams(location.search).get('tab'));
  const [format,setFormat]=useState('B'),[configs,setConfigs]=useState({});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const controller=useRef(null),config=configs[format];
  useEffect(()=>{
    chrome.storage.local.get('areas').then(value=>setConfigs(value.areas || {}));
    const stop=message=>{if(message.type==='stop-solver')controller.current?.abort();};
    const detached=(source,reason)=>{if(source.tabId===tabId)controller.current?.abort(new Error(`Browser control disconnected: ${reason}. Analyze again.`));};
    const key=event=>{if(event.key==='Escape')controller.current?.abort();};
    chrome.runtime.onMessage.addListener(stop);chrome.debugger.onDetach.addListener(detached);window.addEventListener('keydown',key);
    return ()=>{controller.current?.abort();chrome.runtime.onMessage.removeListener(stop);chrome.debugger.onDetach.removeListener(detached);window.removeEventListener('keydown',key);};
  },[]);
  async function mark() {
    setBusy(true);setError(false);setMessage('On the puzzle tab, draw the complete dialog and click inside it to confirm.');
    try {
      const selection=await calibrate(tabId);
      if(selection){const next={...configs,[format]:selection};await chrome.storage.local.set({areas:next});setConfigs(next);setMessage('Area saved. Connect the engine and analyze the current puzzle.');}
      else setMessage('Area selection cancelled.');
      const win=await chrome.windows.getCurrent();await chrome.windows.update(win.id,{focused:true});
    }catch(e){setError(true);setMessage(e.message);}
    finally{setBusy(false);}
  }
  return <main>
    <header><h1>Midasbuy Captcha Solver</h1><p>Analyze, review, then solve one puzzle.</p></header>
    <Card className="panel" role="region" aria-label="Puzzle settings">
      <label htmlFor="format">Format</label>
      <select id="format" value={format} disabled={busy} onChange={e=>{setFormat(e.target.value);setMessage('');setError(false);}}>
        <option value="A">Format A (Slider)</option><option value="B">Format B (selector)</option>
      </select>
      <Button className="area-button solver-full" variant="outline" disabled={busy || !tabId} onClick={mark}>{config?'Adjust capture area':'Mark capture area'}</Button>
      {!tabId && <p className="solver-note">Open this extension from the puzzle tab.</p>}
      {config && <p className="area-detail">{config.rect.width} &times; {config.rect.height} pixels</p>}
      {message && <p className={error?'status error':'status'} role={error?'alert':'status'}>{message}</p>}
    </Card>
    <SolverPanel tabId={tabId} format={format} config={config} busy={busy} setBusy={setBusy} controller={controller} />
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
