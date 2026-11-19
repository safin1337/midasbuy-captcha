// Integration against a local fixture only; never contacts Midasbuy.
const {chromium} = require('D:/Projects/soulshopbd-website/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const evidence = path.join(root,'evidence');
fs.mkdirSync(evidence,{recursive:true});
const fixture = `<!doctype html><html><body style="margin:0;background:#ddd"><div style="position:absolute;left:50px;top:80px;background:white;padding:10px;width:420px;height:460px;box-sizing:content-box"><h2 style="margin:0;height:50px">Verification fixture</h2><canvas width="420" height="350"></canvas><button style="width:50px;height:50px">Reload</button></div><script>
let n=0;window.trusted=[];window.reloadTimes=[];const c=document.querySelector('canvas').getContext('2d');
function draw(){c.fillStyle='hsl('+((n*51)%360)+',80%,50%)';c.fillRect(0,0,420,350);for(let i=0;i<25;i++){c.fillStyle='hsl('+((n*87+i*31)%360)+',70%,30%)';c.fillRect((i*47+n*17)%380,(i*61+n*13)%310,40,40);}}
draw();document.querySelector('button').onclick=e=>{trusted.push(e.isTrusted);reloadTimes.push(performance.now());n++;if(n===1)fetch('/telemetry').catch(()=>{});c.fillStyle='white';c.fillRect(0,0,420,350);const img=new Image();img.onload=draw;img.src='/image.svg?n='+n;};
</script></body></html>`;
const imageFinished=[];
const server=http.createServer((req,res)=>{
  if(req.url==='/telemetry')return; // Intentionally unfinished child-frame analytics request.
  if(req.url==='/'){
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><body style="margin:0;height:1800px"><iframe id="challenge" src="http://localhost:${server.address().port}/frame" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`);
  }else if(req.url.startsWith('/image.svg')){
    const n=Number(new URL(req.url,'http://localhost').searchParams.get('n'));
    setTimeout(()=>{imageFinished[n]=Date.now();res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>');},n===1?7000:300);
  }else{res.setHeader('Content-Type','text/html');res.end(fixture);}
});
let context, page, target;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  // Chrome activeTab normally comes from a toolbar click. Give ONLY the local
  // fixture host to a separate test manifest, because Playwright cannot click
  // browser toolbar actions. Production dist manifest stays unchanged.
  const extension=path.join(evidence,'test-extension');
  fs.cpSync(path.join(root,'dist'),extension,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));
  manifest.host_permissions=['http://127.0.0.1/*','http://localhost/*'];
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(evidence,'profile-'+Date.now()),{channel:'chromium',headless:true,viewport:null,args:['--window-size=1280,1000','--force-device-scale-factor=1.25',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  target=await context.newPage();
  await target.goto(`http://127.0.0.1:${server.address().port}/`);
  await target.frameLocator('#challenge').locator('canvas').waitFor();
  const challenge=target.frames().find(f=>f.url().startsWith('http://localhost:'));
  const tabId=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(t=>t.url?.startsWith('http://127.0.0.1:')).id;});
  const originalWindows=await worker.evaluate(async()=>chrome.windows.getAll());
  const popupPromise=context.waitForEvent('page');
  const opened=await worker.evaluate(async tabId=>{
    const tab=await chrome.tabs.get(tabId);
    return Promise.all([openControls(tab),openControls(tab)]);
  },tabId);
  assert.equal(opened[0].id,opened[1].id,'Concurrent opens must reuse one window');
  page=await popupPromise;
  await page.waitForURL(`chrome-extension://${id}/index.html?tab=${tabId}`);
  const reopened=await worker.evaluate(async tabId=>openControls(await chrome.tabs.get(tabId)),tabId);
  assert.equal(reopened.id,opened[0].id,'Reopening must focus the actual controls');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory();
    const b=await root.getDirectoryHandle('Format_B',{create:true});const dir=await b.getDirectoryHandle('raw_data',{create:true});
    const f=await dir.getFileHandle('input14.png',{create:true});const w=await f.createWritable();await w.write('sentinel');await w.close();
    await new Promise((resolve,reject)=>{const req=indexedDB.open('captcha-extraction',1);req.onupgradeneeded=()=>req.result.createObjectStore('settings');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').delete('destinations-v1');tx.objectStore('settings').put(root,'root');tx.oncomplete=()=>{db.close();resolve();};};});
  });
  await page.reload();
  page.on('console',m=>{if(m.text().startsWith('CAPTURE_STATUS'))console.log(m.text());});
  await page.evaluate(()=>new MutationObserver(()=>console.log('CAPTURE_STATUS '+document.querySelector('.status')?.textContent)).observe(document.querySelector('#root'),{childList:true,subtree:true,characterData:true}));
  await page.getByRole('button',{name:'Change folder'}).waitFor();
  // The legacy project root migrates to its existing raw_data folder. Then
  // exercise choosing an arbitrary final output folder through the UI. The
  // native picker is stubbed; the directory handles and disk writes are real.
  await page.getByText(/Currently Selected:.*Format_B\\raw_data/).waitFor();
  await page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory();
    const chosen=await root.getDirectoryHandle('Selected photos',{create:true});
    const f=await chosen.getFileHandle('input14.png',{create:true});const w=await f.createWritable();await w.write('sentinel');await w.close();
    window.showDirectoryPicker=async options=>{window.pickerOptions={id:options.id,startIn:options.startIn?.name,mode:options.mode};return chosen;};
  });
  await page.getByRole('button',{name:'Change folder'}).click();
  await page.getByText(/Currently Selected:.*Selected photos/).waitFor();
  assert.deepEqual(await page.evaluate(()=>pickerOptions),{id:'captcha-output-B',startIn:'raw_data',mode:'readwrite'});
  await page.reload();
  await page.getByText(/Currently Selected:.*Selected photos/).waitFor();
  await page.getByRole('button',{name:'Mark capture area'}).click();
  await target.locator('[data-captcha-picker]').waitFor();
  await target.mouse.move(50,80);await target.mouse.down();await target.mouse.move(490,560,{steps:12});await target.mouse.up();
  await target.getByText('Now click the reload button inside the box. This marks its position only.',{exact:true}).waitFor();
  await target.mouse.click(85,510);
  await page.getByText('Area and reload point saved. Ready for 10 images.').waitFor();
  console.log('Calibration passed. Running ten browser captures.');
  assert.equal(await challenge.evaluate(()=>trusted.length),0,'Calibration must not click reload');
  // Reproduce the user's rejection: change the usable window height after
  // calibration, scroll behind a fixed CAPTCHA, and change the SPA fragment.
  const previous=await target.evaluate(()=>({width:innerWidth,height:innerHeight}));
  await target.setViewportSize({width:previous.width,height:previous.height-48});
  await target.evaluate(()=>{history.replaceState(null,'','#capture-route');scrollTo(0,37);});
  const current=await target.evaluate(()=>({width:innerWidth,height:innerHeight,scrollY}));
  assert.notEqual(previous.height,current.height);
  assert.ok(current.scrollY>0);
  await target.waitForTimeout(300);
  for (const frame of [target.mainFrame(),challenge]) await frame.evaluate(()=>{
    window.captureDisruptions=[];
    addEventListener('resize',()=>captureDisruptions.push({type:'resize',width:innerWidth,height:innerHeight}));
    document.addEventListener('visibilitychange',()=>captureDisruptions.push({type:'visibility',state:document.visibilityState}));
  });
  await page.getByRole('button',{name:'Start 10 captures'}).click();
  await Promise.race([
    page.getByText('Complete. Saved 10 images. Start again for another batch.').waitFor({timeout:180000}),
    page.getByRole('alert').waitFor({timeout:180000}).then(async()=>{throw new Error(await page.getByRole('alert').innerText());}),
  ]);
  console.log('Ten captures complete. Checking files and interruption.');
  const captureDisruptions=await Promise.all([target.mainFrame(),challenge].map(f=>f.evaluate(()=>captureDisruptions)));
  assert.deepEqual(captureDisruptions,[[],[]],'Screenshot polling must not resize or hide the page or challenge frame');
  const files=await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('Selected photos');const result=[];for await(const [name,h]of dir.entries()){assertFile(h);const f=await h.getFile();result.push({name,size:f.size,type:f.type,lastModified:f.lastModified});}return result;function assertFile(h){if(h.kind!=='file')throw new Error('Capture created an unwanted subfolder');}});
  const legacyFiles=await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const b=await root.getDirectoryHandle('Format_B');const dir=await b.getDirectoryHandle('raw_data');return [...await Array.fromAsync(dir.keys())];});
  assert.deepEqual(legacyFiles,['input14.png'],'Changing destination must leave the old directory untouched');
  assert.equal(files.length,11);assert.ok(files.some(f=>f.name==='input24.png'));assert.ok(files.filter(f=>f.name!=='input14.png').every(f=>f.size>1000));
  assert.deepEqual(await challenge.evaluate(()=>trusted),Array(10).fill(true));
  const reloadTimes=await challenge.evaluate(()=>reloadTimes);
  const intervals=reloadTimes.slice(1).map((t,i)=>Math.round(t-reloadTimes[i]));
  assert.ok(intervals[0]>7000,'The seven-second image must extend its cycle');
  assert.ok(intervals.slice(1).every(ms=>ms>=4800&&ms<=6500),`Expected five-second normal cycles: ${intervals}`);
  for(let n=1;n<=10;n++)assert.ok(files.find(f=>f.name===`input${n+14}.png`).lastModified>=imageFinished[n],`Image ${n} saved before its resource loaded`);
  const dimensions=await page.locator('.preview').evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight}));
  const dpr=await target.evaluate(()=>devicePixelRatio);
  // The browser's native screenshot density is 125%, even when Playwright's
  // viewport emulation reports a different DOM devicePixelRatio.
  assert.deepEqual(dimensions,{width:550,height:600});
  const corner=await page.locator('.preview').evaluate(async e=>{
    const bitmap=await createImageBitmap(await(await fetch(e.src)).blob());
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
    const pixel=Array.from(ctx.getImageData(bitmap.width-4,bitmap.height-4,1,1).data);bitmap.close();return pixel;
  });
  assert.deepEqual(corner,[255,255,255,255],'In-memory crop must preserve the selected card after scrolling');
  const finalWindows=await worker.evaluate(async()=>chrome.windows.getAll({populate:true}));
  assert.equal(finalWindows.length,originalWindows.length+1,'Capture must not create extra windows');
  const report=await page.evaluate(async()=> (await chrome.storage.local.get('lastRun')).lastRun);
  assert.equal(report.state,'complete');assert.equal(report.saved,10);
  // Start a second batch then stop before its first changed image can save.
  await page.getByRole('button',{name:'Start 10 captures'}).click();
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await page.getByText(/Stopped\. 0 of 10/).waitFor();
  await page.getByLabel('Format',{exact:true}).selectOption('A');
  await page.getByText('Currently Selected: No folder selected',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Start 10 captures'}).isDisabled(),true,'Format A needs its own calibration');
  const states=[];
  const captureScript=fs.existsSync(path.join(evidence,'spacing-script.txt')) ? fs.readFileSync(path.join(evidence,'spacing-script.txt'),'utf8') : null;
  for(const width of [390,1440,1728]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(evidence,`controls-${width}.png`),fullPage:true});
    if(captureScript)states.push(await page.evaluate(captureScript));
  }
  fs.writeFileSync(path.join(evidence,'spacing-states.json'),JSON.stringify(states));
  fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({files,trustedMouseEvents:10,reloadIntervalsMs:intervals,dimensions,dpr,captureDisruptions,viewportBefore:previous,viewportAfter:current,scrolledCropCorrect:true,extraWindows:0,crossOriginFrame:true,unfinishedTelemetryIgnored:true,stop:true,separateFormatConfig:true,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,images:10,first:'input15.png',last:'input24.png',reloadIntervalsMs:intervals,dimensions,dpr,viewportBefore:previous,viewportAfter:current,scrolledCropCorrect:true,extraWindows:0,crossOriginFrame:true,unfinishedTelemetryIgnored:true,stop:true,separateFormatConfig:true,errors}));
})().catch(async e=>{console.error(e);if(page){console.error(await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});}if(target){console.error(await target.locator('[data-captcha-picker]').innerText().catch(()=>''));await target.screenshot({path:path.join(evidence,'failure-picker.png')}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{await context?.close();server.closeAllConnections();server.close();});
