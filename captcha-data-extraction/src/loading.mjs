// Passive network readiness, including cross-origin CAPTCHA iframe targets.
// Pixel stability remains necessary for canvas rendering and decoded images.
export function watchImageLoads(tabId) {
  const pending = new Set(), setup = new Set();
  let active = false, lastActivity = 0, error, disposed = false;
  const root = {tabId};
  const send = (target,method,params={}) => chrome.debugger.sendCommand(target,method,params);
  async function enable(target) {
    await send(target,'Network.enable');
    if (!disposed) await send(target,'Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true,filter:[{type:'iframe',exclude:false}]});
  }
  function event(source, method, params) {
    if (source.tabId !== tabId || disposed) return;
    if (method === 'Target.attachedToTarget') {
      const target = {tabId,sessionId:params.sessionId};
      const job = enable(target).catch(()=>{ if (!disposed) error = new Error('Could not monitor a CAPTCHA frame. Stop and reopen the extension.'); });
      setup.add(job); job.finally(()=>setup.delete(job)); return;
    }
    if (method === 'Target.detachedFromTarget') {
      for (const key of pending) if (key.startsWith(params.sessionId+':')) pending.delete(key);
      lastActivity = Date.now(); return;
    }
    if (!active) return;
    const key = `${source.sessionId || 'root'}:${params.requestId}`;
    if (method === 'Network.requestWillBeSent' && params.type === 'Image') {
      pending.add(key); lastActivity = Date.now();
    } else if (method === 'Network.responseReceived' && (pending.has(key) || /^image\//i.test(params.response.mimeType || ''))) {
      // Fetch/XHR can carry an image, but telemetry/long-poll requests must not
      // hold a successfully rendered CAPTCHA hostage to whole-frame network idle.
      pending.add(key); lastActivity = Date.now();
      if (params.response.status >= 400) error = new Error('An image request failed. No screenshot saved.');
    } else if (pending.has(key) && ['Network.loadingFinished','Network.loadingFailed'].includes(method)) {
      pending.delete(key); lastActivity = Date.now();
      if (method === 'Network.loadingFailed' && !params.canceled) error = new Error('An image could not finish loading. No screenshot saved.');
    }
  }
  return {
    async prepare() {
      chrome.debugger.onEvent.addListener(event);
      await enable(root);
      while (setup.size) await Promise.all([...setup]);
    },
    begin() { pending.clear(); active=true; lastActivity=Date.now(); },
    ready() {
      if (error) throw error;
      return pending.size === 0 && setup.size === 0 && Date.now()-lastActivity >= 550;
    },
    details() { return {pendingImages:pending.size,framesStarting:setup.size}; },
    dispose() { disposed=true; chrome.debugger.onEvent.removeListener(event); pending.clear(); },
  };
}
