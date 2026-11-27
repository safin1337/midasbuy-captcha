import React,{useEffect,useState} from 'react';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {Input} from './components/ui/input';
import {Checkbox} from './components/ui/checkbox';
import {analyzeOnTab,engineRequest,setManualPoints,solveOnTab} from './solver-browser.mjs';
import {ManualPoints} from './ManualPoints';

export function SolverPanel({tabId,format,config,busy,setBusy,controller}) {
  const [code,setCode]=useState(''),[connected,setConnected]=useState(false);
  const [storedResult,setResult]=useState(null),[reviewed,setReviewed]=useState(false);
  const [manualOpen,setManualOpen]=useState(false);
  const result=storedResult?.format===format?storedResult:null;
  const [operation,setOperation]=useState(''),[status,setStatus]=useState('Connect the local engine to analyze this puzzle.');
  const [error,setError]=useState(false),[stepLog,setStepLog]=useState({format,entries:[]});
  // Hide incompatible data synchronously. useEffect clears state after rendering,
  // which is too late when a B click entry is interpreted as an A measurement.
  const steps=stepLog.format===format?stepLog.entries:[];
  const setSteps=entries=>setStepLog({format,entries});
  useEffect(()=>{chrome.storage.session.get('solverCode').then(value=>{if(value.solverCode)setCode(value.solverCode);});},[]);
  useEffect(()=>{setResult(null);setReviewed(false);setManualOpen(false);setSteps([]);setError(false);setStatus('Analyze the current puzzle before solving.');},[format,config]);
  async function run(name,work) {
    if (busy) return;
    const abort=new AbortController();controller.current=abort;
    setBusy(true);setOperation(name);setError(false);
    try {await work(abort.signal);}
    catch(e) {setError(e.name!=='AbortError');setStatus(e.name==='AbortError'?'Stopped. Analyze the puzzle before another attempt.':e.message);if(name!=='connect' && name!=='manual')setResult(null);}
    finally {controller.current=null;setBusy(false);setOperation('');}
  }
  function connect() {return run('connect',async signal=>{
    setConnected(false);setStatus('Connecting to the local engine.');
    const health=await engineRequest('/health',code.trim(),null,signal);
    if(!health.features?.includes('dom_guidance') || !health.features?.includes('manual_points'))throw new Error('Restart the local engine to enable guided detection and manual points, then connect with its new code.');
    await chrome.storage.session.set({solverCode:code.trim()});
    setConnected(true);setStatus('Engine connected. Analyze the current puzzle.');
  });}
  function analyze() {return run('analyze',async signal=>{
    setResult(null);setReviewed(false);setManualOpen(false);setSteps([]);
    const proposal=await analyzeOnTab({tabId,config,format,code:code.trim(),signal,status:setStatus});
    setResult(proposal);
    setStatus(!proposal.has_proposal?'No complete match. Adjust the area or solve manually.':proposal.status==='detected'?'Proposal ready. Check the preview before solving.':'Uncertain proposal. Review the highlighted locations before solving.');
  });}
  function applyPoints(points) {return run('manual',async signal=>{
    const corrected=await setManualPoints(result,points,code.trim(),signal);
    setResult(corrected);setReviewed(true);setManualOpen(false);
    setStatus('Manual points applied. Review the positions, then solve once.');
  });}
  function solve() {return run('solve',async signal=>{
    setSteps([]);
    let entries=[];
    const save=record=>chrome.storage.local.set({lastSolve:{format,job:result.job,updatedAt:Date.now(),steps:entries,...record}});
    await save({state:'running',message:'Starting one solve action.'});
    try {
      const outcome=await solveOnTab({tabId,config,result,reviewed,code:code.trim(),signal,status:setStatus,
        progress:async entry=>{entries=[...entries,entry];setSteps(entries);await save({state:'running'});}});
      await save({state:outcome.status,message:outcome.message,remaining:outcome.remaining});
      setStatus(outcome.message);
    } catch(e) {await save({state:signal.aborted?'stopped':'error',message:e.message});throw e;}
    finally {setResult(null);setReviewed(false);}
  });}
  return <Card className="panel solver-panel" role="region" aria-label="Puzzle solver">
    <h2>Solve current puzzle</h2>
    <p className="solver-note">Start <code>.\start-solver.ps1</code>, then enter its connection code.</p>
    <label htmlFor="solver-code">Engine connection code</label>
    <Input id="solver-code" type="password" autoComplete="off" value={code} disabled={busy}
      onChange={e=>{setCode(e.target.value);setConnected(false);setResult(null);}} />
    <Button variant="outline" className="solver-full" disabled={busy || !code.trim()} onClick={connect}>{connected?'Reconnect engine':'Connect engine'}</Button>
    <div className="solver-actions">
      <Button variant="outline" disabled={busy || !connected || !config || !tabId} onClick={analyze}>Analyze puzzle</Button>
      {operation && operation!=='connect'?<Button variant="destructive" onClick={()=>controller.current?.abort()}>Stop</Button>:
        <Button disabled={busy || manualOpen || !result?.has_proposal || result.status!=='detected' && !reviewed} onClick={solve}>Solve once</Button>}
    </div>
    {!config && <p className="solver-note">Mark the capture area above, including the complete verification dialog.</p>}
    {result?.preview && <img className="preview" src={`data:image/png;base64,${result.preview}`} alt="Proposed puzzle locations for review" />}
    {result?.format==='A' && result.evidence && <p className="solver-note">Piece guidance: {result.evidence.dom_guided?'browser element':'image only'}. Sprite outline: {result.evidence.sprite_silhouette?'available':'unavailable; using image outlines'}.</p>}
    {result?.format==='A' && result.review_reasons?.length>0 && <ul className="solver-steps">{result.review_reasons.map(reason=><li key={reason}>{({weak_outline:'The outline match is weak.',competing_gap_locations:'Different gap locations have similar scores.',inconsistent_piece_alignment:'Overlapping candidates disagree on the movement distance.',weak_gap_darkness:'The target lacks expected gap contrast.'})[reason] || 'This match needs visual review.'}</li>)}</ul>}
    {result?.format==='A' && result.source_image && <>
      <Button variant="outline" className="solver-full" disabled={busy} onClick={()=>setManualOpen(!manualOpen)}>{manualOpen?'Hide manual points':'Set points manually'}</Button>
      {manualOpen && <ManualPoints key={result.job} result={result} busy={busy} onApply={applyPoints} />}
    </>}
    {result?.format==='B' && result.has_proposal && <p className="solver-proposal">Click order: {result.matches.map(m=>m.candidate).join(' → ')} → OK</p>}
    {result?.format==='A' && result.has_proposal && <p className="solver-proposal">Initial A → 1 distance: {Number(result.offset_image_px[0]).toFixed(1)} image pixels. Three-stage drag: 20%, 50%, then remainder.</p>}
    {result?.has_proposal && result.status!=='detected' && <label className="solver-review" htmlFor="solver-reviewed">
      <Checkbox id="solver-reviewed" checked={reviewed} disabled={busy} onCheckedChange={checked=>setReviewed(!!checked)} />
      <span>{result.status==='manual'?'I accept the manually selected centers.':'I reviewed the uncertain proposal and accept these locations.'}</span>
    </label>}
    <p className={error?'status error':'status'} role={error?'alert':'status'}>{status}</p>
    {steps.length>0 && <ol className="solver-steps" aria-label="Solve attempt log">{steps.map((step,i)=><li key={i}>{format==='A'?`Stage ${step.stage}: ${step.remaining.toFixed(2)} px remaining`:step.kind==='confirm'?'Confirmed with OK':`Selection ${step.stage}: ${step.candidate}`}</li>)}</ol>}
  </Card>;
}
