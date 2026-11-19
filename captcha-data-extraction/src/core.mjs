export function nextNumber(names) {
  let max = 0;
  for (const name of names) {
    const match = /^input(\d+)\.png$/i.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  if (!Number.isSafeInteger(max + 1)) throw new Error('Filename counter exceeds the safe integer range.');
  return max + 1;
}

export function captureGeometry(config, current) {
  const {rect,point}=config;
  if (!rect || !point || ![rect.x,rect.y,rect.width,rect.height,point.x,point.y,current.width,current.height].every(Number.isFinite) || rect.width<=0 || rect.height<=0) {
    throw new Error('Capture area is missing or invalid. Mark the capture area.');
  }
  if (config.viewport?.url) {
    const original=new URL(config.viewport.url),actual=new URL(current.url);
    if (original.origin!==actual.origin || original.pathname!==actual.pathname) throw new Error('The CAPTCHA page changed. Open the original page or mark the capture area.');
  }
  // A browser banner, fractional display-scale change, or SPA fragment does not
  // invalidate a visible, manually selected box. Coordinates are viewport-relative.
  if (rect.x<0 || rect.y<0 || rect.x+rect.width>current.width+0.5 || rect.y+rect.height>current.height+0.5) {
    throw new Error('The capture box is outside the visible page. Enlarge the browser window or adjust the capture area.');
  }
  if (point.x<rect.x || point.x>rect.x+rect.width || point.y<rect.y || point.y>rect.y+rect.height) {
    throw new Error('The reload point is outside the capture box. Mark the capture area again.');
  }
  return {rect:{...rect},point:{...point},viewport:current};
}

export function difference(a, b) {
  if (!a || a.length !== b.length) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

export function checkAbort(signal) {
  if (signal.aborted) throw signal.reason || new DOMException('Stopped by user.', 'AbortError');
}

export function randomDelay(random = Math.random) {
  return 1000 + Math.floor(random() * 2001);
}

export async function collect({count = 10, signal, snapshot, click, save, progress, pause, phase = () => {}, now = () => performance.now(), random = Math.random}) {
  if (count <= 0) return;
  checkAbort(signal);
  let before = await snapshot();
  for (let index = 0; index < count; index++) {
    checkAbort(signal);
    const start = now();
    phase({step:'reload',image:index+1});
    await click();
    // Randomize when capture is allowed, within the same five-second budget.
    // Readiness polling runs during this interval rather than adding another wait.
    const captureNotBefore = start + randomDelay(random);
    let previous, changed = false, stable = 0, ready, reportedSecond=-1;
    while (now() - start < 25000) {
      await pause(250, signal);
      checkAbort(signal);
      const shot = await snapshot();
      const currentChanged = difference(before.sample, shot.sample) > 5;
      if (currentChanged) changed = true;
      stable = shot.loaded !== false && currentChanged && difference(previous?.sample, shot.sample) < 0.8 ? stable + 1 : 0;
      previous = shot;
      const elapsedMs=now()-start,second=Math.floor(elapsedMs/1000);
      if (second!==reportedSecond) {
        phase({step:'waiting',image:index+1,elapsedMs:Math.round(elapsedMs),changed:currentChanged,loaded:shot.loaded!==false,stable,...shot.loading});
        reportedSecond=second;
      }
      if (changed && stable >= 3 && now() >= captureNotBefore) {
        // Recheck immediately before saving; there is no additional random pause.
        checkAbort(signal);
        const final = await snapshot();
        if (now() - start >= 25000) break;
        if (final.loaded !== false && difference(shot.sample, final.sample) < 0.8 && difference(before.sample, final.sample) > 5) {
          ready = final; break;
        }
        stable = 0; previous = final;
      }
    }
    if (!ready) {
      if (!changed) throw new Error('No changed CAPTCHA within 25 seconds. Reload may have missed; mark the reload button again.');
      if (previous?.loaded===false) throw new Error('Image downloads did not finish within 25 seconds. Check the CAPTCHA and try again.');
      throw new Error('CAPTCHA did not stabilize within 25 seconds. Check the image and try again.');
    }
    checkAbort(signal);
    phase({step:'saving',image:index+1});
    const name = await save(ready.blob, signal);
    progress(index + 1, name, ready.blob);
    if (index + 1 < count) {
      checkAbort(signal);
      // Include screenshot and file-writing time in the cycle, too.
      before = await snapshot();
      const remaining = 5000 - (now() - start);
      if (remaining > 0) await pause(remaining, signal);
      checkAbort(signal);
    }
  }
}
