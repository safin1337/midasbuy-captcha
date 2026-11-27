const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {captureScript}=require('./layout-capture.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence');
(async()=>{
 const extension=path.join(root,'dist');
 const context=await chromium.launchPersistentContext(path.join(out,'visual-profile-'+Date.now()),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage(),id=new URL(worker.url()).host,states=[];
  const script=captureScript;
  await page.goto(`chrome-extension://${id}/index.html`);
  for(const width of [390,1440,1728]){
   await page.setViewportSize({width,height:900});
   await page.getByRole('heading',{name:'Midasbuy Captcha Solver',exact:true}).waitFor();
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.getByRole('button',{name:'Choose folder'}).count(),0);
   assert.equal(await page.getByRole('button',{name:'Start 10 captures'}).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const small=await page.locator('button,input,select').evaluateAll(items=>items.filter(e=>{const r=e.getBoundingClientRect();return r.width<44 || r.height<44;}).map(e=>e.tagName));
   assert.deepEqual(small,[]);
   states.push(await page.evaluate(script));
   await page.screenshot({path:path.join(out,`solver-${width}.png`),fullPage:true});
  }
  await page.locator('#format').selectOption('A');
  await page.locator('#solver-code').focus();
  await page.screenshot({path:path.join(out,'solver-focus.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'spacing-states.json'),JSON.stringify(states));
  console.log(JSON.stringify({pass:true,widths:[390,1440,1728],collectorControls:0}));
 }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
