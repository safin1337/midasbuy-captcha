import {solverCommand} from './solver-command.mjs';

// Executes independently in each real iframe context. No page tokens or URLs
// leave the context; sprite URLs contribute only to a change-detection hash.
export function inspectPuzzleFrame() {
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && +s.opacity!==0;};
  const handles=[...document.querySelectorAll('.tc-slider-normal')].filter(visible);
  if (handles.length!==1) return null;
  const handle=handles[0], parent=handle.parentElement;
  const pieces=[...parent.querySelectorAll('.tc-fg-item')].filter(e=>{
    if (e===handle || !visible(e)) return false;
    const r=e.getBoundingClientRect();
    return getComputedStyle(e).backgroundImage!=='none' && r.width>=15 && r.width/r.height>.7 && r.width/r.height<1.4;
  });
  if (pieces.length!==1) return null;
  const piece=pieces[0];
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const p=rect(piece),h=rect(handle);
  let hash=2166136261;
  for (const char of [getComputedStyle(piece).backgroundImage,getComputedStyle(piece).backgroundPosition,
                       getComputedStyle(piece).backgroundSize,p.width,p.height,h.width,h.height].join('|')) {
    hash=Math.imul(hash^char.charCodeAt(0),16777619);
  }
  return {piece:p,handle:h,signature:String(hash>>>0)};
}

export async function readPieceSprite() {
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0 && r.height>0 && getComputedStyle(e).visibility!=='hidden';};
  const handles=[...document.querySelectorAll('.tc-slider-normal')].filter(visible);
  if(handles.length!==1)return {status:'no_unique_handle'};
  const pieces=[...handles[0].parentElement.querySelectorAll('.tc-fg-item')].filter(e=>{
    const r=e.getBoundingClientRect();return e!==handles[0] && visible(e) && r.width>=15 && r.width/r.height>.7 && r.width/r.height<1.4 && getComputedStyle(e).backgroundImage!=='none';
  });
  if(pieces.length!==1)return {status:'no_unique_piece'};
  const style=getComputedStyle(pieces[0]),url=/^url\(["']?(.*?)["']?\)$/.exec(style.backgroundImage)?.[1];
  // Only use an already decoded page image. Never fetch a sprite URL, export
  // its query string, or bypass canvas origin protection.
  const image=[...document.images].find(img=>img.complete && img.naturalWidth && (img.currentSrc===url || img.src===url));
  if(!image)return {status:'image_not_exposed'};
  const size=style.backgroundSize.split(' ').map(parseFloat),position=style.backgroundPosition.split(' ').map(parseFloat);
  if(size.length!==2 || position.length!==2 || ![...size,...position].every(Number.isFinite) || !style.backgroundSize.includes('px') || style.backgroundPosition.includes('%'))return {status:'unsupported_sprite_layout'};
  const width=Math.round(parseFloat(style.width)),height=Math.round(parseFloat(style.height));
  if(Math.min(width,height)<14 || Math.max(width,height)>256)return {status:'unsupported_sprite_size'};
  try {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(image,position[0],position[1],size[0],size[1]);
    return {status:'readable',png:canvas.toDataURL('image/png').split(',')[1]};
  } catch {return {status:'origin_protected'};}
}

export function createFrameProbe(tabId) {
  const contexts=new Map(), jobs=new Set();
  let disposed=false, setupError;
  const send=solverCommand;
  const key=target=>target.sessionId || 'root';
  async function enable(target) {
    await send(target,'Runtime.enable');
    await send(target,'Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true,filter:[{type:'iframe',exclude:false}]});
  }
  function event(source,method,params) {
    if (source.tabId!==tabId || disposed) return;
    if (method==='Target.attachedToTarget') {
      const target={tabId,sessionId:params.sessionId};
      const job=enable(target).catch(()=>{setupError=new Error('Could not inspect a challenge frame. Close DevTools and analyze again.');});
      jobs.add(job);job.finally(()=>jobs.delete(job));
    } else if (method==='Runtime.executionContextCreated' && params.context.auxData?.isDefault) {
      contexts.set(`${key(source)}:${params.context.id}`,{target:{tabId,...(source.sessionId?{sessionId:source.sessionId}:{})},id:params.context.id});
    } else if (method==='Runtime.executionContextDestroyed') contexts.delete(`${key(source)}:${params.executionContextId}`);
    else if (method==='Runtime.executionContextsCleared') {
      for (const [k,c] of contexts) if (key(c.target)===key(source)) contexts.delete(k);
    } else if (method==='Target.detachedFromTarget') {
      for (const [k,c] of contexts) if (c.target.sessionId===params.sessionId) contexts.delete(k);
    }
  }
  async function read(context) {
    const response=await send(context.target,'Runtime.evaluate',{expression:`(${inspectPuzzleFrame.toString()})()`,contextId:context.id,returnByValue:true});
    if (response.exceptionDetails) throw new Error('The challenge frame could not be inspected. Analyze again.');
    return response.result.value;
  }
  return {
    async prepare() {
      chrome.debugger.onEvent.addListener(event);
      await enable({tabId});
      while (jobs.size) await Promise.all([...jobs]);
      if (setupError) throw setupError;
    },
    async locate() {
      if (setupError) throw setupError;
      const found=[];
      for (const context of contexts.values()) {
        try { const state=await read(context);if (state) found.push({context,state}); } catch { /* Context may have navigated. */ }
      }
      if (found.length!==1) throw new Error('A unique moving puzzle element was not found. Keep one slider open and close DevTools.');
      return found[0];
    },
    async read(context) {
      const state=await read(context);
      if (!state) throw new Error('The moving piece disappeared. Analyze the puzzle again.');
      return state;
    },
    async sprite(context) {
      const response=await send(context.target,'Runtime.evaluate',{expression:`(${readPieceSprite.toString()})()`,contextId:context.id,returnByValue:true,awaitPromise:true});
      return response.result?.value || {status:'unavailable'};
    },
    dispose() {disposed=true;chrome.debugger.onEvent.removeListener(event);contexts.clear();},
  };
}
