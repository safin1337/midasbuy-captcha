const { chromium } = require('D:/Projects/soulshopbd-website/node_modules/playwright');
const fs = require('node:fs');
const readline = require('node:readline');
const path = require('node:path');
const root = 'D:/Projects/midasbuy-captcha';
const out = path.join(root, 'inspection');
const routes = [
'https://www.midasbuy.com/midasbuy/bd/buy/pubgm?from=self#/pages/shop/wow',
'https://www.midasbuy.com/midasbuy/bd/buy/pubgm?from=self#/pages/shop/sub',
'https://www.midasbuy.com/midasbuy/bd/buy/pubgm?from=self#/pages/shop/currency',
'https://www.midasbuy.com/midasbuy/bd/redeem/pubgm#/pages/shop/currency'];
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  async function pause() { const ms = 1000 + Math.floor(Math.random()*4001); console.log('PAUSE '+ms+' ms'); await page.waitForTimeout(ms); }
  async function capture(name) {
    await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});
    const data = await page.evaluate(() => ({title:document.title,url:location.href,text:document.body.innerText.slice(0,16000),inputs:Array.from(document.querySelectorAll('input')).map(e=>({type:e.type,placeholder:e.placeholder,aria:e.getAttribute('aria-label')})),buttons:Array.from(document.querySelectorAll('button,[role=button]')).map(e=>({text:e.innerText,aria:e.getAttribute('aria-label'),class:e.className})).slice(0,70),frames:Array.from(document.querySelectorAll('iframe')).map(e=>{let src;try {const u=new URL(e.src,location.href);src=u.origin+u.pathname;}catch{src='unknown'}return {id:e.id,title:e.title,src};})}));
    fs.writeFileSync(path.join(out,name+'.json'), JSON.stringify(data,null,2));
    console.log(JSON.stringify({...data,text:data.text.slice(0,1700)}));
  }
  for (let i=0;i<routes.length;i++) {
    await pause();
    try { await page.goto(routes[i],{waitUntil:'domcontentloaded',timeout:45000}); await page.getByText('Enter Your Player ID Now',{exact:true}).first().waitFor({timeout:30000}); await pause(); await capture('route-'+(i+1)); }
    catch(error) { console.log('NAV_ERROR '+error.message); }
  }
  await pause();
  await page.locator('[aria-label="Close"]').first().click({timeout:5000}).catch(() => {});
  await pause();
  await page.getByText('Reject All Optional Cookies',{exact:true}).first().click({timeout:5000}).catch(() => {});
  await pause();
  await page.getByText('Enter Your Player ID Now',{exact:true}).first().click({timeout:10000});
  await pause();
  await page.frameLocator('iframe[src*="common-sdk"]').getByPlaceholder('Enter Player ID',{exact:true}).fill('52050823502');
  await pause();
  await page.frameLocator('iframe[src*="common-sdk"]').getByText('OK',{exact:true}).click({timeout:10000});
  await pause();
  await capture('verification-result');
  console.log('CAPTURED: inspection/verification-result.png');
  if (!process.argv.includes('--interactive')) { await browser.close(); return; }
  console.log('READY: JSON commands capture, clickText, clickSelector, fill, clickPoint, inspect, goto, exit');
  const rl = readline.createInterface({input:process.stdin,output:process.stdout,terminal:false});
  for await (const line of rl) {
    try {
      const cmd=JSON.parse(line);
      if(cmd.op==='exit') break;
      await pause();
      if(cmd.op==='clickText') await page.getByText(cmd.text,{exact:true}).first().click({timeout:10000});
      if(cmd.op==='clickSelector') await page.locator(cmd.selector).first().click({timeout:10000});
      if(cmd.op==='fill') await page.locator(cmd.selector).first().fill(cmd.value,{timeout:10000});
      if(cmd.op==='inspect') console.log(JSON.stringify(await page.locator(cmd.selector).evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,class:e.className,role:e.getAttribute('role'),type:e.getAttribute('type'),placeholder:e.getAttribute('placeholder')})))));
      if(cmd.op==='goto') await page.goto(cmd.url,{waitUntil:'domcontentloaded',timeout:45000});
      if(cmd.op==='clickPoint') await page.mouse.click(cmd.x,cmd.y);
      await capture(cmd.name || 'current');
      console.log('READY');
    } catch(error) {console.log('COMMAND_ERROR '+error.message);}
  }
  await browser.close();
})().catch(error=>{console.error(error.message);process.exitCode=1;});


