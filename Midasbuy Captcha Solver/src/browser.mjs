import {captureGeometry, checkAbort} from './core.mjs';

async function bounded(operation, label) {
  let timer;
  try { return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} did not respond within 8 seconds. Stop and reopen the extension.`)),8000);})]); }
  finally { clearTimeout(timer); }
}

export function viewportInfo() {
  return {width:innerWidth, height:innerHeight, scrollX, scrollY, dpr:devicePixelRatio,
    scale:visualViewport?.scale || 1, url:location.href};
}
export async function viewport(tabId) {
  const results = await bounded(chrome.scripting.executeScript({target:{tabId}, func:viewportInfo}),'Page position check');
  return results[0].result;
}

// Runs in the top frame; its overlay intercepts clicks above cross-origin CAPTCHA frames.
export function pickOnPage() {
  return new Promise(resolve => {
    document.querySelector('[data-captcha-picker]')?.remove();
    const layer = document.createElement('div');
    layer.dataset.captchaPicker = 'true';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:#0002;touch-action:none';
    const message = document.createElement('div');
    message.textContent = 'Drag the screenshot box (magenta area). Escape cancels.';
    message.style.cssText = 'position:absolute;top:12px;left:12px;right:12px;padding:14px;background:#181818;color:white;font:16px system-ui;pointer-events:none';
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;border:2px solid magenta;pointer-events:none;box-sizing:border-box';
    layer.append(message, box);
    document.documentElement.append(layer);
    let origin, rect, selection, stage = 'box';
    const oldFocus = document.activeElement;
    layer.tabIndex = -1; layer.focus();
    function finish(value) { layer.remove(); window.removeEventListener('keydown', key, true); oldFocus?.focus?.({preventScroll:true}); resolve(value); }
    function key(e) { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') finish(null); }
    window.addEventListener('keydown', key, true);
    layer.onclick = e => {
      e.preventDefault(); e.stopImmediatePropagation();
      // Consume the entire marking click before removing the overlay. Removing
      // it on pointerdown can let pointerup/click reach the underlying page.
      if (selection) finish(selection);
    };
    layer.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation();
      if (e.button !== 0) return;
      if (stage === 'point') {
        if (e.clientX < rect.x || e.clientX > rect.x + rect.width || e.clientY < rect.y || e.clientY > rect.y + rect.height) {
          message.textContent = 'Click INSIDE the magenta box to confirm. Escape cancels.'; return;
        }
        selection={rect, point:{x:e.clientX,y:e.clientY}, viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,dpr:devicePixelRatio,scale:visualViewport?.scale || 1,url:location.href}};
      } else { origin = {x:e.clientX,y:e.clientY}; layer.setPointerCapture(e.pointerId); }
    };
    layer.onpointermove = e => {
      if (!origin || stage !== 'box') return;
      rect = {x:Math.round(Math.min(origin.x,e.clientX)),y:Math.round(Math.min(origin.y,e.clientY)),width:Math.round(Math.abs(e.clientX-origin.x)),height:Math.round(Math.abs(e.clientY-origin.y))};
      Object.assign(box.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
    };
    layer.onpointerup = () => {
      if (!origin || stage !== 'box') return;
      origin = null;
      if (!rect || rect.width < 100 || rect.height < 100) { message.textContent = 'Draw a box at least 100 × 100 pixels. Escape cancels.'; return; }
      stage = 'point';
      message.textContent = 'Now click inside the box to confirm. This does not interact with the puzzle.';
    };
  });
}

export async function calibrate(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.windows.update(tab.windowId,{focused:true});
  await chrome.tabs.update(tabId,{active:true});
  // Calibrate with the same debugging banner that will be present during a run.
  await chrome.debugger.attach({tabId},'1.3');
  try {
    await new Promise(resolve=>setTimeout(resolve,300));
    const result = await chrome.scripting.executeScript({target:{tabId},func:pickOnPage});
    return result[0].result;
  } finally { await chrome.debugger.detach({tabId}).catch(()=>{}); }
}

export function installEscape() {
  window.__captchaExtractionStop?.();
  const handler = e => {
    if (e.key === 'Escape') chrome.runtime.sendMessage({type:'stop-solver'}).catch(() => {});
  };
  window.addEventListener('keydown',handler,true);
  window.__captchaExtractionStop = () => { window.removeEventListener('keydown',handler,true); delete window.__captchaExtractionStop; };
}
export function removeEscape() { window.__captchaExtractionStop?.(); }

export function createBrowserCapture(tabId, config, loading) {
  const target = {tabId};
  const send = (method, params = {}) => bounded(chrome.debugger.sendCommand(target, method, params),method);
  const geometry = async () => captureGeometry(config,await viewport(tabId));
  return {
    async click(signal) {
      checkAbort(signal);
      const {point:{x,y}} = await geometry();
      loading?.begin();
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
      checkAbort(signal);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
    },
    async snapshot() {
      const {rect,viewport:v} = await geometry();
      // Capture the existing browser view. Surface clips can temporarily alter
      // compositor geometry and flash cross-origin challenge frames while polling.
      // Never send a clip or device-metrics override to the live page.
      const {data} = await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      const {viewport:after} = await geometry();
      const changed=['width','height','scrollX','scrollY','dpr','scale'].filter(key=>v[key]!==after[key]);
      if (changed.length) {
        throw new Error(`The page moved during capture (${changed.map(key=>`${key}: ${v[key]} → ${after[key]}`).join(', ')}). Keep the browser still and start again.`);
      }
      const viewBlob=await (await fetch(`data:image/png;base64,${data}`)).blob();
      const bitmap = await createImageBitmap(viewBlob);
      try {
        // Use this capture's actual viewport and bitmap, never saved calibration
        // dimensions. View coordinates already exclude the page scroll offset.
        const sx=bitmap.width/v.width,sy=bitmap.height/v.height;
        const crop=new OffscreenCanvas(Math.max(1,Math.round(rect.width*sx)),Math.max(1,Math.round(rect.height*sy)));
        crop.getContext('2d').drawImage(bitmap,rect.x*sx,rect.y*sy,rect.width*sx,rect.height*sy,0,0,crop.width,crop.height);
        const blob=await crop.convertToBlob({type:'image/png'});
        const sampleCanvas = new OffscreenCanvas(64,64);
        // Ignore title/footer/cursor: compare the challenge's central image.
        sampleCanvas.getContext('2d').drawImage(crop,crop.width*.12,crop.height*.25,crop.width*.76,crop.height*.5,0,0,64,64);
        const sample = sampleCanvas.getContext('2d').getImageData(0,0,64,64).data;
        return {blob,sample,loaded:loading ? loading.ready() : true,loading:loading?.details()};
      } finally { bitmap.close(); }
    },
  };
}
