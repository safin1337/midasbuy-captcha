const {chromium}=require('D:/Projects/soulshopbd-website/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence');
(async()=>{
 const extension=path.join(root,'dist');
 const context=await chromium.launchPersistentContext(path.join(out,'visual-profile-'+Date.now()),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host,page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/index.html`);
  const script=fs.readFileSync(path.join(out,'scoped-script.txt'),'utf8'),states=[];
  for(const width of [390,1440,1728,460]){
   await page.setViewportSize({width,height:790});await page.getByRole('heading',{name:'Captcha Data Extraction'}).waitFor();await page.evaluate(async()=>{await document.fonts.load('600 23px Geist');await document.fonts.ready;});
   const measured=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,font:getComputedStyle(document.querySelector('h1')).fontFamily,fontLoaded:document.fonts.check('600 23px Geist'),small:[...document.querySelectorAll('button,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width<44||r.height<44;}).map(e=>e.textContent)}));
   console.log(JSON.stringify({width,...measured}));assert.equal(measured.overflow,0);assert.equal(measured.fontLoaded,true);assert.match(measured.font,/Geist/);assert.deepEqual(measured.small,[]);
   await page.screenshot({path:path.join(out,`controls-${width}.png`),fullPage:true});
   states.push({...await page.evaluate(script),name:`popup-${width}`});
  }
  await page.setViewportSize({width:460,height:790});await page.getByRole('button',{name:'Choose folder'}).focus();states.push({...await page.evaluate(script),name:'popup-folder-focus'});
  const ownTab=await page.evaluate(async()=>{await chrome.storage.local.set({areas:{B:{rect:{x:50,y:80,width:386,height:386},point:{x:85,y:410},viewport:{}}}});return (await chrome.tabs.getCurrent()).id;});
  await page.goto(`chrome-extension://${id}/index.html?tab=${ownTab}`);
  await page.getByText('Choose the folder where photos will be saved.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Start 10 captures'}).isDisabled(),true);
  await page.getByRole('button',{name:'Adjust capture area'}).waitFor();
  states.push({...await page.evaluate(script),name:'calibrated-folder-required'});
  await page.screenshot({path:path.join(out,'folder-required.png')});
  await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const handle=await root.getDirectoryHandle('raw_data',{create:true});await new Promise((resolve,reject)=>{const req=indexedDB.open('captcha-extraction',1);req.onupgradeneeded=()=>req.result.createObjectStore('settings');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({B:{handle,visiblePath:'midasbuy-captcha\\Format_B\\raw_data'}},'destinations-v1');tx.oncomplete=()=>{db.close();resolve();};};});});
  await page.reload();
  await page.getByRole('button',{name:'Change folder'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Start 10 captures'}).isEnabled(),true);
  await page.getByText('Ready for 10 images.',{exact:true}).waitFor();
  await page.getByText('Currently Selected: [Hidden by Chrome]\\midasbuy-captcha\\Format_B\\raw_data',{exact:true}).waitFor();
  for(const width of [390,1440,1728]){
   await page.setViewportSize({width,height:790});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   states.push({...await page.evaluate(script),name:`selected-folder-${width}`});
   await page.screenshot({path:path.join(out,`selected-folder-${width}.png`),fullPage:true});
  }
  await page.evaluate(async tabId=>chrome.storage.local.set({lastRun:{version:chrome.runtime.getManifest().version,tabId,state:'error',saved:1,message:'Reload may have missed. Mark the reload button again. (1 of 10 saved.)'}}),ownTab);
  await page.reload();
  await page.getByRole('alert').filter({hasText:'Reload may have missed.'}).waitFor();
  assert.equal(await page.locator('progress').getAttribute('value'),'1');
  states.push({...await page.evaluate(script),name:'persisted-stop-reason'});
  await page.screenshot({path:path.join(out,'persisted-stop-reason.png')});
  await page.evaluate(async tabId=>chrome.storage.local.set({lastRun:{version:chrome.runtime.getManifest().version,tabId,state:'running',saved:1,step:'waiting'}}),ownTab);
  await page.reload();
  await page.getByRole('alert').filter({hasText:'Previous capture ended before completion. 1 of 10 images saved.'}).waitFor();
  await page.evaluate(async tabId=>chrome.storage.local.set({lastRun:{version:'1.0.4',tabId,state:'error',saved:0,message:'Page position, size, zoom, or URL changed.'}}),ownTab);
  await page.reload();
  await page.getByText('Ready for 10 images.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('alert').count(),0,'Old-version failures must not be shown as a new failure');
  fs.writeFileSync(path.join(out,'spacing-states.json'),JSON.stringify(states));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,widths:[390,1440,1728,460],overflow:0,fontsLoaded:true,errors}));
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
