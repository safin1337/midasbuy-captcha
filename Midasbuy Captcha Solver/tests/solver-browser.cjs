// Real extension/CDP input on nested local cross-origin frames. No live provider.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {captureScript}=require('./layout-capture.cjs');
const root=path.resolve(__dirname,'..'),project=path.resolve(root,'..'),out=path.join(root,'evidence');
const recordedPath=path.join(out,'engine-format-b.json');
const recorded=fs.existsSync(recordedPath)?JSON.parse(fs.readFileSync(recordedPath)):
  {...JSON.parse(fs.readFileSync(path.join(project,'Format_B/diagnostics/dot_evaluation/input/result.json'))),confirm_center:[420,429.5]};
const image=fs.readFileSync(path.join(project,'Format_B/raw_data/input.png'));
let engine,context,controls,target,worker,inner;
const bFixture=`<!doctype html><body style="margin:0"><img id="puzzle" src="/image" style="position:absolute;left:80px;top:70px;width:475px;height:480px"><script>
window.events=[];document.querySelector('img').onclick=e=>events.push({x:e.clientX-80,y:e.clientY-70,trusted:e.isTrusted});
</script>`;
const aFixture=`<!doctype html><body style="margin:0"><div id="tcOperation" style="position:absolute;left:80px;top:70px;width:425px;height:420px;background:#eee">
<div style="position:absolute;left:0;top:0;width:425px;height:80px;background:#0080ff"></div>
<div style="position:absolute;left:0;top:80px;width:425px;height:247px;background:#ddd"></div>
<div style="position:absolute;left:180px;top:150px;width:50px;height:50px;background:#444"></div>
<div id="piece" class="tc-fg-item" style="position:absolute;left:45px;top:150px;width:50px;height:50px;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect width=%2250%22 height=%2250%22 fill=%22green%22/%3E%3C/svg%3E');background-size:50px 50px;background-position:0px 0px"></div>
<div class="tc-fg-item" style="position:absolute;left:0;top:370px;width:425px;height:16px;background:#aaa"></div>
<div id="handle" class="tc-fg-item tc-slider-normal" style="position:absolute;left:20px;top:355px;width:82px;height:45px;border-radius:25px;background:#0080ff"></div></div>
<script>window.events=[];window.active=false;let startX,startHandle,startPiece;
const handle=document.querySelector('#handle'),piece=document.querySelector('#piece');
const decodedSprite=new Image();decodedSprite.src=getComputedStyle(piece).backgroundImage.slice(5,-2);decodedSprite.style.display='none';document.body.append(decodedSprite);
handle.onmousedown=e=>{active=true;startX=e.clientX;startHandle=parseFloat(handle.style.left);startPiece=parseFloat(piece.style.left);events.push({type:'down',trusted:e.isTrusted,time:performance.now()});e.preventDefault();};
document.onmousemove=e=>{if(active){const dx=e.clientX-startX;handle.style.left=(startHandle+dx)+'px';piece.style.left=(startPiece+dx)+'px';}};
document.onmouseup=e=>{if(active){active=false;events.push({type:'up',trusted:e.isTrusted,time:performance.now()});}};
</script>`;
const server=http.createServer((req,res)=>{
  const port=server.address().port;
  if(req.url==='/image'){res.setHeader('Content-Type','image/jpeg');return res.end(image);}
  res.setHeader('Content-Type','text/html');
  if(req.url==='/')return res.end(`<!doctype html><body style="margin:0"><iframe src="http://localhost:${port}/outer" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`);
  if(req.url==='/outer')return res.end(`<!doctype html><body style="margin:0"><iframe src="http://127.0.0.1:${port}/puzzle?format=B" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`);
  res.end(req.url.includes('format=A')?aFixture:bFixture);
});
async function connect(){
  await controls.locator('#solver-code').fill('synthetic-browser-fixture');
  await controls.getByRole('button',{name:'Connect engine',exact:true}).click();
  await Promise.race([
    controls.getByText('Engine connected. Analyze the current puzzle.',{exact:true}).waitFor(),
    controls.locator('.solver-panel [role=alert]').waitFor().then(async()=>{throw Error(await controls.locator('.solver-panel [role=alert]').innerText());}),
  ]);
}
async function analyze(){
  await controls.getByRole('button',{name:'Analyze puzzle',exact:true}).click();
  await Promise.race([
    controls.getByText(/Proposal ready\.|Uncertain proposal\./).waitFor({timeout:25000}),
    controls.locator('.solver-panel [role=alert]').waitFor({timeout:25000}).then(async()=>{throw Error(await controls.locator('.solver-panel [role=alert]').innerText());}),
  ]);
}
async function resetA(){
  await inner.goto(`http://127.0.0.1:${server.address().port}/puzzle?format=A`);
  await inner.locator('#handle').waitFor();
  await analyze();
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  engine=spawn(path.join(project,'.venv/Scripts/python.exe'),['-u',path.join(__dirname,'engine_fixture.py'),'18765'],{cwd:project,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Local fixture engine did not start. Port 18765 must be free.')),10000);
    engine.stdout.on('data',chunk=>{if(chunk.toString().includes('FIXTURE_ENGINE_READY')){clearTimeout(timeout);resolve();}else console.log(chunk.toString().trim());});
    engine.stderr.on('data',chunk=>{clearTimeout(timeout);reject(Error(chunk.toString()));});
    engine.on('error',reject);
  });
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  const extension=path.join(out,'solver-test-extension');
  fs.cpSync(path.join(root,'dist'),extension,{recursive:true});
  // Isolate test transport from the user's running engine. Production bundle
  // stays on 8765; only this copied test extension uses the fixture port.
  for(const name of fs.readdirSync(path.join(extension,'assets')).filter(name=>name.endsWith('.js'))){
    const file=path.join(extension,'assets',name);
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('http://127.0.0.1:8765','http://127.0.0.1:18765'));
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));
  manifest.host_permissions=['http://127.0.0.1/*','http://localhost/*'];
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(out,'solver-profile-'+Date.now()),{channel:'chromium',headless:true,viewport:{width:1280,height:900},deviceScaleFactor:1.25,
    args:['--site-per-process','--force-device-scale-factor=1.25',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  target=await context.newPage();await target.goto(`http://127.0.0.1:${server.address().port}/`);
  await target.frameLocator('iframe').frameLocator('iframe').locator('#puzzle').waitFor();
  inner=target.frames().find(frame=>frame.url().includes('/puzzle?'));
  const tabId=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(tab=>tab.url?.startsWith('http://127.0.0.1:')).id;});
  const popup=context.waitForEvent('page');
  await worker.evaluate(async id=>openControls(await chrome.tabs.get(id)),tabId);
  controls=await popup;await controls.waitForLoadState();
  const url=target.url();
  await controls.evaluate(async url=>chrome.storage.local.set({areas:{
    A:{rect:{x:80,y:70,width:425,height:420},point:{x:110,y:465},viewport:{url}},
    B:{rect:{x:80,y:70,width:475,height:480},point:{x:120,y:500},viewport:{url}},
  }}),url);
  await controls.reload();await controls.getByRole('button',{name:'Adjust capture area'}).waitFor();
  const errors=[];controls.on('pageerror',error=>errors.push(error.message));
  await connect();await analyze();
  assert.equal(await controls.getByRole('button',{name:'Solve once',exact:true}).isDisabled(),true);
  await controls.getByText('I reviewed the uncertain proposal and accept these locations.',{exact:true}).click();
  await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await controls.getByText(/Three symbols selected and OK clicked\./).waitFor();
  const clicks=await inner.evaluate(()=>events);
  assert.equal(clicks.length,4);assert.ok(clicks.every(event=>event.trusted));
  const expected=[...recorded.matches.map(match=>match.center),recorded.confirm_center];
  clicks.forEach((point,i)=>{assert.ok(Math.abs(point.x-expected[i][0])<2);assert.ok(Math.abs(point.y-expected[i][1])<2);});
  console.log('Format B: ordered real input + OK, review gate, DPR 1.25 passed.');
  // Regression: B's click log has no numeric "remaining". Switching to A must
  // not render those entries as slider stages before reset effects run.
  await controls.locator('#format').selectOption('A');
  await controls.getByRole('heading',{name:'Midasbuy Captcha Solver',exact:true}).waitFor({timeout:2000});
  assert.equal(await controls.getByRole('region',{name:'Puzzle solver',exact:true}).count(),1);
  assert.equal(await controls.getByRole('list',{name:'Solve attempt log'}).count(),0);
  assert.deepEqual(errors,[],'Switching B to A must not throw a render exception');
  await controls.locator('#format').selectOption('B');
  await analyze();
  await controls.getByText('I reviewed the uncertain proposal and accept these locations.',{exact:true}).click();
  await inner.locator('#puzzle').evaluate(element=>element.style.filter='hue-rotate(90deg)');
  await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await controls.getByRole('alert').filter({hasText:'different puzzle'}).waitFor();
  assert.equal(await inner.evaluate(()=>events.length),4,'A stale proposal must send no new input');
  await controls.locator('#format').selectOption('A');
  await resetA();
  await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await controls.getByText(/Three-stage drag released\./).waitFor({timeout:20000});
  const slider=await inner.evaluate(()=>({piece:parseFloat(document.querySelector('#piece').style.left),active,events}));
  assert.ok(Math.abs(slider.piece-180)<=1.5,JSON.stringify(slider));assert.equal(slider.active,false);
  assert.deepEqual(slider.events.map(event=>event.type),['down','up']);assert.ok(slider.events.every(event=>event.trusted));
  const holdMs=slider.events[1].time-slider.events[0].time;
  assert.ok(holdMs<10000,`Drag took ${holdMs} ms`);
  console.log(`Smooth three-stage held drag: ${holdMs.toFixed(0)} ms (under 10 seconds).`);
  const trialNames=fs.readdirSync(path.join(out,'solver_fixture_trials','Format_A')).filter(name=>/^trial\d+$/.test(name));
  const finalTrial=trialNames.sort((a,b)=>Number(a.slice(5))-Number(b.slice(5))).at(-1);
  const trial=JSON.parse(fs.readFileSync(path.join(out,'solver_fixture_trials','Format_A',finalTrial,'trial.json')));
  assert.equal(trial.status,'input_sent');assert.equal(trial.events.filter(event=>event.type==='stage').length,3);
  assert.ok(fs.existsSync(path.join(out,'solver_fixture_trials','Format_A',finalTrial,'after.png')));
  console.log('Format A: nested cross-origin DOM feedback, three held stages, final release, trial files passed.');
  await controls.locator('#format').selectOption('B');
  await controls.getByRole('heading',{name:'Midasbuy Captcha Solver',exact:true}).waitFor();
  assert.equal(await controls.getByRole('list',{name:'Solve attempt log'}).count(),0);
  assert.equal(await controls.getByRole('button',{name:'Reconnect engine',exact:true}).count(),1);
  await controls.locator('#format').selectOption('A');
  assert.deepEqual(errors,[],'Both format switches must preserve the rendered interface');
  await resetA();
  await controls.getByRole('button',{name:'Set points manually',exact:true}).click();
  assert.equal(await controls.getByRole('button',{name:'Solve once',exact:true}).isDisabled(),true,'Unapplied manual edits must not use the old automatic proposal');
  const states=[],spacingScript=captureScript;
  for(const width of [390,1440,1728]){
    await controls.setViewportSize({width,height:1000});
    assert.equal(await controls.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    states.push(await controls.evaluate(spacingScript));
    await controls.screenshot({path:path.join(out,`manual-${width}.png`),fullPage:true});
  }
  fs.writeFileSync(path.join(out,'manual-spacing-states.json'),JSON.stringify(states));
  const manualImage=await controls.locator('.manual-canvas img').boundingBox();
  await controls.locator('.manual-canvas').click({position:{x:70/425*manualImage.width,y:175/420*manualImage.height}});
  await controls.locator('.manual-canvas').click({position:{x:205/425*manualImage.width,y:175/420*manualImage.height}});
  assert.equal(await controls.getByRole('button',{name:'Apply manual points',exact:true}).isEnabled(),true);
  const imageScale=await controls.locator('.manual-canvas img').evaluate(img=>img.naturalWidth/425);
  for(const [i,value] of [70,175,205,175].entries())await controls.locator(`#manual-point-${i}`).fill(String(Math.round(value*imageScale)));
  await controls.getByRole('button',{name:'Apply manual points',exact:true}).click();
  await controls.getByText('Manual points applied. Review the positions, then solve once.',{exact:true}).waitFor();
  await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await controls.getByText(/Three-stage drag released\./).waitFor();
  assert.ok(Math.abs(await inner.evaluate(()=>parseFloat(document.querySelector('#piece').style.left))-180)<1.5);
  console.log('Manual center selection applies explicit provenance and uses the same held drag.');
  await resetA();await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await inner.waitForFunction(()=>active===true);
  await controls.getByRole('button',{name:'Stop',exact:true}).click();
  await controls.getByText('Stopped. Analyze the puzzle before another attempt.',{exact:true}).waitFor();
  assert.equal(await inner.evaluate(()=>active),false,'Stop must release the held mouse');
  console.log('Stop during held drag passed.');
  await resetA();await controls.getByRole('button',{name:'Solve once',exact:true}).click();
  await inner.waitForFunction(()=>active===true);
  await controls.close();
  await inner.waitForFunction(()=>active===false);
  console.log('Closing controls releases the held mouse before detach.');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'solver-browser-report.json'),JSON.stringify({pass:true,nestedCrossOrigin:true,dpr:1.25,formatBClicks:clicks,slider,trial:finalTrial,stopReleased:true,closeReleased:true,scope:'Local fixtures; not provider verification'},null,2));
})().catch(async error=>{console.error(error);if(controls&&!controls.isClosed()){console.error(await controls.locator('.solver-panel').innerText({timeout:1000}).catch(()=>'(Solver panel is blank)'));await controls.screenshot({path:path.join(out,'solver-failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{
  await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));engine?.kill();
});
