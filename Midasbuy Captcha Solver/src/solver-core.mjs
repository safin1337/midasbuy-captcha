import {checkAbort} from './core.mjs';

export function imagePoint(point, result, rect) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) ||
      ![result.width,result.height].every(v=>Number.isFinite(v) && v>0) ||
      point[0]<0 || point[1]<0 || point[0]>=result.width || point[1]>=result.height) {
    throw new Error('Detector returned an invalid position. Analyze the puzzle again.');
  }
  return {x:rect.x+point[0]*rect.width/result.width,y:rect.y+point[1]*rect.height/result.height};
}

export function validateProposal(result, reviewed=false) {
  if (!result?.has_proposal) throw new Error('No complete proposal. Adjust the capture area and analyze again.');
  if (result.status!=='detected' && !reviewed) throw new Error('Review the uncertain proposal before solving.');
  if (result.format==='B') {
    const matches=result.matches;
    if (matches?.length!==3 || new Set(matches.map(m=>m.candidate)).size!==3 ||
        matches.some((m,i)=>m.order!==i+1 || !Array.isArray(m.center)) || !Array.isArray(result.confirm_center)) {
      throw new Error('The ordered proposal is incomplete. Analyze again.');
    }
  } else if (result.format==='A') {
    if (!result.offset_image_px || !Number.isFinite(result.offset_image_px[0]) || result.offset_image_px[0]<=0 ||
        Math.abs(result.offset_image_px[1])>4 || result.slider?.status!=='located') {
      throw new Error('Slider or piece alignment is unclear. Adjust the capture area and analyze again.');
    }
  } else throw new Error('Unsupported puzzle format.');
}

export async function stagedDrag({distance,read,press,move,release,signal,report=()=>{},tolerance=1.5,timeoutMs=9000}) {
  if (!Number.isFinite(distance) || distance<=0) throw new Error('The initial horizontal distance is invalid.');
  checkAbort(signal);
  const baseline=await read();
  const deadline=new AbortController();
  const dragSignal=AbortSignal.any([signal,deadline.signal]);
  let timer;
  function bounded(operation) {
    checkAbort(dragSignal);
    return new Promise((resolve,reject)=>{
      const stop=()=>reject(dragSignal.reason);
      dragSignal.addEventListener('abort',stop,{once:true});
      Promise.resolve().then(operation).then(resolve,reject).finally(()=>dragSignal.removeEventListener('abort',stop));
    });
  }
  let previous=baseline, ratio=1, remaining=distance, pressed=false;
  const log=[];
  function verify(state) {
    if (state.signature!==baseline.signature) throw new Error('The challenge changed. Analyze the new puzzle.');
    if (![state.piece.x,state.piece.y,state.handle.x].every(Number.isFinite) ||
        Math.abs(state.piece.y-baseline.piece.y)>2) throw new Error('The tracked piece moved unexpectedly.');
  }
  try {
    // Mark as pressed first: an interrupted transport response can still deliver
    // the button-down. The finally path must release in that case too.
    pressed=true;
    timer=setTimeout(()=>deadline.abort(new Error('Drag time limit reached. Released before another movement; analyze again.')),timeoutMs);
    await bounded(()=>press(dragSignal));
    for (const [index,fraction] of [.2,.5,1].entries()) {
      checkAbort(dragSignal);
      const amount=remaining*ratio*fraction;
      if (Math.abs(remaining)>tolerance) await bounded(()=>move(amount,dragSignal));
      checkAbort(dragSignal);
      const current=await bounded(()=>read(dragSignal));
      verify(current);
      const pieceDelta=current.piece.x-previous.piece.x;
      const handleDelta=current.handle.x-previous.handle.x;
      if (Math.abs(amount)>tolerance && Math.abs(pieceDelta)<.25) throw new Error('The piece did not move. Check that the handle is unobstructed.');
      if (Math.abs(pieceDelta)>=.25) {
        ratio=handleDelta/pieceDelta;
        if (!Number.isFinite(ratio) || ratio<.3 || ratio>3) throw new Error('Live movement scale is inconsistent. Stop and review this puzzle.');
      }
      remaining=distance-(current.piece.x-baseline.piece.x);
      const entry={stage:index+1,fraction,handleMovement:amount,pieceMovement:pieceDelta,remaining,handlePerPiece:ratio,
        observedPiece:current.piece,observedHandle:current.handle};
      log.push(entry);await bounded(()=>report(entry));previous=current;
    }
    if (Math.abs(remaining)>tolerance) throw new Error(`Final horizontal offset is ${remaining.toFixed(2)} px. Alignment could not be confirmed.`);
    return {aligned:true,remaining,stages:log};
  } finally { clearTimeout(timer);if (pressed) await release(); }
}

// Schedule by elapsed time rather than replaying a fixed event queue. Slow
// commands skip obsolete positions instead of extending the drag duration.
export async function smoothMove({from,amount,send,signal,durationMs=700,now=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
  const started=now();
  while (true) {
    checkAbort(signal);
    const t=Math.min(1,(now()-started)/durationMs);
    const eased=t*t*(3-2*t);
    await send({x:from.x+amount*eased,y:from.y});
    if (t===1) return;
    await wait(16);
  }
}
