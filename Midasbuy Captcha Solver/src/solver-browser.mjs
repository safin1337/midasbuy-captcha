import {captureGeometry,checkAbort,difference} from './core.mjs';
import {createBrowserCapture,installEscape,removeEscape,viewport} from './browser.mjs';
import {createFrameProbe} from './frame-probe.mjs';
import {imagePoint,smoothMove,stagedDrag,validateProposal} from './solver-core.mjs';
import {solverCommand} from './solver-command.mjs';

const ENGINE='http://127.0.0.1:8765';
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function engineRequest(path,code,payload,signal) {
  let response;
  try {
    response=await fetch(ENGINE+path,{method:payload?'POST':'GET',headers:{'X-Solver-Key':code,...payload?{'Content-Type':'application/json'}:{}},
      body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.any([signal,AbortSignal.timeout(path==='/analyze'?95000:4000)]),cache:'no-store'});
  } catch(e) {
    if (signal.aborted) throw signal.reason || new DOMException('Stopped.','AbortError');
    throw new Error('Local engine is unavailable. Run start-solver.ps1 and connect with its current code.');
  }
  const result=await response.json();
  if (!response.ok) throw new Error(result.error || 'Local analysis failed.');
  return result;
}

async function session(tabId,signal,work) {
  return navigator.locks.request('midasbuy-captcha-solver-run',{ifAvailable:true},async lock=>{
    if (!lock) throw new Error('Another capture or solve is running. Stop it first.');
    let attached=false;
    const probe=createFrameProbe(tabId);
    try {
      checkAbort(signal);
      const tab=await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId,{active:true});
      await chrome.windows.update(tab.windowId,{focused:true});
      try {await chrome.debugger.attach({tabId},'1.3');attached=true;}
      catch {throw new Error('Could not control this tab. Close DevTools or other debugging extensions, then try again.');}
      await chrome.scripting.executeScript({target:{tabId},func:installEscape});
      await probe.prepare();
      await pause(350);
      return await work(probe);
    } finally {
      probe.dispose();
      await chrome.scripting.executeScript({target:{tabId},func:removeEscape}).catch(()=>{});
      if (attached) await chrome.debugger.detach({tabId}).catch(()=>{});
    }
  });
}

function sameView(a,b) {
  return ['width','height','scrollX','scrollY','dpr','scale','url'].every(key=>a[key]===b[key]);
}

async function pngData(blob) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Screenshot could not be read.'));reader.readAsDataURL(blob);});
}

export async function analyzeOnTab({tabId,config,format,code,signal,status}) {
  return session(tabId,signal,async probe=>{
    status('Checking the current puzzle.');
    const browser=createBrowserCapture(tabId,config);
    const before=await browser.snapshot();await pause(400);checkAbort(signal);
    const shot=await browser.snapshot();
    if (difference(before.sample,shot.sample)>.8) throw new Error('The puzzle is still changing. Wait for it to finish loading and analyze again.');
    const v=await viewport(tabId),{rect}=captureGeometry(config,v);
    const frame=format==='A'?await probe.locate():null;
    const sprite=frame?await probe.sprite(frame.context):null;
    const png=await pngData(shot.blob);
    status(format==='B'?'Matching the three reference symbols.':'Finding the piece and gap.');
    const result=await engineRequest('/analyze',code,{format,png,...frame?{guidance:{dom:frame.state,sprite_status:sprite.status,sprite_png:sprite.png}}:{}},signal);
    checkAbort(signal);
    const latest=await browser.snapshot();
    if (!sameView(v,await viewport(tabId)) || difference(shot.sample,latest.sample)>.8) throw new Error('The puzzle changed during analysis. Analyze the new puzzle.');
    return {...result,_sample:Array.from(shot.sample),_rect:rect,_viewport:v,_signature:frame?.state.signature,_created:Date.now(),_tabId:tabId};
  });
}

export async function setManualPoints(result,points,code,signal) {
  const corrected=await engineRequest('/manual',code,{job:result.job,points},signal);
  return {...corrected,...Object.fromEntries(Object.entries(result).filter(([key])=>key.startsWith('_')))};
}

export async function solveOnTab({tabId,config,result,reviewed,code,signal,status,progress}) {
  validateProposal(result,reviewed);
  if (result._tabId!==tabId || Date.now()-result._created>180000) throw new Error('This proposal expired. Analyze the current puzzle.');
  return session(tabId,signal,async probe=>{
    const v=await viewport(tabId),{rect}=captureGeometry(config,v);
    if (!sameView(v,result._viewport) || JSON.stringify(rect)!==JSON.stringify(result._rect)) throw new Error('The page or capture area moved. Analyze again.');
    const browser=createBrowserCapture(tabId,config),current=await browser.snapshot();
    if (difference(result._sample,current.sample)>.8) throw new Error('This proposal belongs to a different puzzle. Analyze the current one.');
    const send=(method,params,timeoutMs)=>solverCommand({tabId},method,params,timeoutMs);
    const guard=async(held,point)=>{
      const response=await chrome.runtime.sendMessage({type:'solver-input-state',tabId,held,point});
      if (!response?.ok) throw new Error('Control window lost its target tab. Reopen the extension.');
    };
    let held=false,position;
    async function input(type,point,activeSignal=signal) {
      if (type!=='mouseReleased') checkAbort(activeSignal);
      if (point.x<rect.x || point.x>rect.x+rect.width || point.y<rect.y || point.y>rect.y+rect.height) throw new Error('Mouse target is outside the marked puzzle.');
      position=point;
      if (type==='mousePressed') held=true;
      if (type==='mousePressed') await guard(true,point);
      else if (type==='mouseMoved' && held) {
        // Update emergency-release coordinates without waiting for a storage
        // write or a round trip before every animation frame.
        chrome.runtime.sendMessage({type:'solver-pointer-position',tabId,point}).catch(()=>{});
      }
      if (type!=='mouseReleased') checkAbort(activeSignal);
      await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:held?1:0,...type!=='mouseMoved'?{clickCount:1}:{}},type==='mouseReleased'?750:8000);
      if (type==='mouseReleased') {held=false;await guard(false,point);}
    }
    try {
      if (result.format==='B') {
        const trial=await engineRequest('/trials/start',code,{format:'B',job:result.job,
          plan:{reviewed,initial_detection_status:result.status,matches:result.matches,confirm_center:result.confirm_center,
            capture_rect:rect,viewport:{width:v.width,height:v.height,dpr:v.dpr,scale:v.scale}}},signal);
        async function record(event,finish=false) {
          let png;
          if(finish)try{png=await pngData((await browser.snapshot()).blob);}catch{/* Page may close after confirmation. */}
          return engineRequest(finish?'/trials/finish':'/trials/event',code,{format:'B',trial:trial.trial,event,png},finish?new AbortController().signal:signal);
        }
        try {
        const points=result.matches.map(match=>imagePoint(match.center,result,rect));
        for (const [i,point] of points.entries()) {
          checkAbort(signal);
          if (!sameView(v,await viewport(tabId))) throw new Error('The page moved during selection. Review the puzzle manually.');
          status(`Selecting symbol ${i+1} of ${points.length}.`);
          await input('mouseMoved',point);await input('mousePressed',point);await input('mouseReleased',point);
          await record({type:'selection',order:i+1,candidate:result.matches[i].candidate,screen_css:point});
          await progress?.({stage:i+1,candidate:result.matches[i].candidate});
          await pause(220);
        }
        checkAbort(signal);
        if (!sameView(v,await viewport(tabId))) throw new Error('The page moved before confirmation. Review the puzzle manually.');
        const confirm=imagePoint(result.confirm_center,result,rect);
        status('Confirming the three selected symbols.');
        await input('mouseMoved',confirm);await input('mousePressed',confirm);await input('mouseReleased',confirm);
        await record({type:'confirm',screen_css:confirm});
        await progress?.({stage:4,candidate:'OK',kind:'confirm'});
        await record({type:'finished',status:'input_sent',note:'Selections and OK sent; website acceptance is not inferred.'},true);
        return {status:'input_sent',trial:trial.trial,message:`Three symbols selected and OK clicked. Check the page for verification. Saved in ${trial.relative_path}.`};
        } catch(e) {
          await record({type:'finished',status:signal.aborted?'aborted':'error',error:e.message},true).catch(()=>{});
          throw e;
        }
      }
      const frame=await probe.locate();
      if (frame.state.signature!==result._signature) throw new Error('The slider image changed. Analyze again.');
      const start=imagePoint(result.slider.zero_center,result,rect);
      const handleWidth=result.slider.handle_box[2]*rect.width/result.width;
      const frameScale=handleWidth/frame.state.handle.width;
      if (!Number.isFinite(frameScale) || frameScale<.25 || frameScale>4) throw new Error('Frame scale is unclear. Analyze again.');
      const read=async(activeSignal=signal)=>{
        checkAbort(activeSignal);
        await pause(50);
        checkAbort(activeSignal);
        if (!sameView(v,await viewport(tabId))) throw new Error('The page moved during dragging.');
        const state=await probe.read(frame.context);
        return {...state,piece:{...state.piece,x:state.piece.x*frameScale,y:state.piece.y*frameScale},handle:{...state.handle,x:state.handle.x*frameScale}};
      };
      let cursor={...start};
      const distance=result.offset_image_px[0]*rect.width/result.width;
      const trial=await engineRequest('/trials/start',code,{format:'A',job:result.job,
        plan:{distance_css_px:distance,tolerance_css_px:1.5,fractions:[.2,.5,1],reviewed,
          initial_detection_status:result.status,initial_dom:frame.state,frame_scale:frameScale,
          capture_rect:rect,viewport:{width:v.width,height:v.height,dpr:v.dpr,scale:v.scale},
          stage_duration_ms:700,max_hold_ms:9000,target_release_ms:10000}},signal);
      let trialWrites=Promise.resolve();
      let loggingError;
      const started=performance.now();
      async function finishTrial(event) {
        let png;
        try {png=await pngData((await browser.snapshot()).blob);} catch { /* The page may have closed or changed layout. */ }
        await trialWrites;
        await engineRequest('/trials/finish',code,{format:'A',trial:trial.trial,event:{...event,logging_error:loggingError?.message},png},new AbortController().signal);
      }
      try {
      const outcome=await stagedDrag({distance,signal,read,
        press:async activeSignal=>{await input('mouseMoved',start,activeSignal);await input('mousePressed',start,activeSignal);},
        move:(amount,activeSignal)=>smoothMove({from:{...cursor},amount,signal:activeSignal,
          send:async point=>{await input('mouseMoved',point,activeSignal);cursor=point;}}),
        release:()=>input('mouseReleased',cursor),
        report:entry=>{
          const event={type:'stage',...entry,elapsed_ms:Math.round(performance.now()-started)};
          trialWrites=trialWrites.then(()=>engineRequest('/trials/event',code,{format:'A',trial:trial.trial,event},new AbortController().signal)).catch(error=>{loggingError=error;});
          Promise.resolve(progress?.(entry)).catch(error=>{loggingError=error;});status(`Stage ${entry.stage}/3: ${entry.remaining.toFixed(2)} px remaining.`);
        },
      });
      const dragElapsedMs=Math.round(performance.now()-started);
      await finishTrial({type:'finished',status:'input_sent',remaining:outcome.remaining,aligned:outcome.aligned,drag_elapsed_ms:dragElapsedMs,
        note:'Horizontal alignment only; website acceptance is not inferred.'});
      return {status:'input_sent',trial:trial.trial,message:`Three-stage drag released. Check the page for verification. Saved in ${trial.relative_path}.`,...outcome};
      } catch(e) {
        await finishTrial({type:'finished',status:signal.aborted?'aborted':'error',error:e.message}).catch(()=>{});
        throw e;
      }
    } finally {
      // Also covers partially delivered button-down commands and cancelled moves.
      if (held && position) await input('mouseReleased',position).catch(()=>{});
      await guard(false,position || {x:rect.x,y:rect.y}).catch(()=>{});
    }
  });
}
