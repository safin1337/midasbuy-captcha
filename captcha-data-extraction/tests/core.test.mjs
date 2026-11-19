import test from 'node:test';
import assert from 'node:assert/strict';
import {nextNumber, collect, captureGeometry, randomDelay} from '../src/core.mjs';
import {createSequentialSaver} from '../src/files.mjs';

test('continues after largest numbered input, ignoring other files',()=>{
  assert.equal(nextNumber(['input.png','input2.png','input14.png','input9.png','output100.png']),15);
  assert.equal(nextNumber([]),1);
  assert.equal(nextNumber(['INPUT0016.PNG']),17);
});
test('visible selection survives browser banner, scroll, DPI rounding, and SPA fragment changes',()=>{
  const config={rect:{x:100,y:100,width:378,height:384},point:{x:140,y:460},viewport:{width:1200,height:900,scrollX:0,scrollY:0,dpr:1.25,scale:1,url:'https://example.test/buy#old'}};
  const current={width:1199,height:840,scrollX:0,scrollY:1,dpr:1.2500001,scale:1,url:'https://example.test/buy#new'};
  const result=captureGeometry(config,current);
  assert.deepEqual(result.rect,config.rect);assert.deepEqual(result.point,config.point);assert.equal(result.viewport,current);
  assert.equal(config.viewport.height,900,'Saved settings must not be overwritten');
  assert.throws(()=>captureGeometry(config,{...current,height:400}),/outside the visible page/);
  assert.throws(()=>captureGeometry(config,{...current,url:'https://other.test/buy'}),/page changed/);
  assert.throws(()=>captureGeometry(config,{...current,url:'https://example.test/login'}),/page changed/);
  assert.throws(()=>captureGeometry({...config,point:{x:700,y:700}},current),/reload point is outside/);
});
function harness(mode) {
  let time=0, generation=0, clicks=0, saved=0;
  const abort=new AbortController();
  const opts={signal:abort.signal,now:()=>time,pause:async ms=>{time+=ms;},
    snapshot:async()=>({sample:new Uint8ClampedArray([generation*20]),blob:new Blob(['png'])}),
    click:async()=>{clicks++;if(mode!=='unchanged')generation++;},
    save:async()=>{saved++;if(mode==='stop')abort.abort();if(mode==='disk')throw new Error('Disk full');return `input${saved}.png`;},
    progress:()=>{}};
  return {opts,abort,counts:()=>({clicks,saved})};
}
test('one run reloads and saves exactly ten changed stable images',async()=>{
  const h=harness();await collect(h.opts);assert.deepEqual(h.counts(),{clicks:10,saved:10});
});
test('random capture timing spans 1–3 seconds inside five-second reload cycles',async()=>{
  assert.equal(randomDelay(()=>0),1000);assert.equal(randomDelay(()=>0.999999),3000);
  for(const fraction of [0,0.5,0.999999]){
    const h=harness(),clicks=[],saves=[];let time=0;
    h.opts.random=()=>fraction;h.opts.now=()=>time;h.opts.pause=async ms=>{time+=ms;};
    const click=h.opts.click,snapshot=h.opts.snapshot,save=h.opts.save;
    h.opts.click=async()=>{clicks.push(time);await click();};
    h.opts.snapshot=async()=>{time+=60;return snapshot();};
    h.opts.save=async()=>{time+=80;saves.push(time);return save();};
    await collect({...h.opts,count:3});
    assert.equal(clicks[1]-clicks[0],5000);assert.equal(clicks[2]-clicks[1],5000);
    assert.ok(saves[0]-clicks[0]>=randomDelay(()=>fraction));
    assert.ok(saves[0]<clicks[1]);
  }
});
test('a stable loading screen is not saved while image requests are pending',async()=>{
  const h=harness();let time=0,saveTime;
  h.opts.now=()=>time;h.opts.pause=async ms=>{time+=ms;};h.opts.random=()=>0;
  const snapshot=h.opts.snapshot;
  h.opts.snapshot=async()=>({...await snapshot(),loaded:time>=9000});
  h.opts.save=async()=>{saveTime=time;return 'input1.png';};
  await collect({...h.opts,count:1});assert.ok(saveTime>=9000);
});
test('image changing during the final readiness check is checked again before saving',async()=>{
  const h=harness();let samples=0,saved;
  h.opts.random=()=>0;
  h.opts.snapshot=async()=>({sample:new Uint8ClampedArray([samples++===0?0:samples<=5?20:60]),blob:new Blob([String(samples)])});
  h.opts.save=async blob=>{saved=await blob.text();return 'input1.png';};
  await collect({...h.opts,count:1});assert.ok(Number(saved)>6);
});
test('Stop during readiness or the remaining cycle wait prevents further work',async()=>{
  for(const which of ['readiness','remainder']){
    const h=harness();let pauses=0;
    h.opts.random=()=>0;
    const pause=h.opts.pause;
    h.opts.pause=async ms=>{await pause(ms);pauses++;if((which==='readiness'&&pauses===1)||(which==='remainder'&&ms>250))h.abort.abort();};
    await assert.rejects(collect(h.opts),{name:'AbortError'});
    assert.equal(h.counts().saved,which==='readiness'?0:1);assert.equal(h.counts().clicks,1);
  }
});
test('slow image or disk operations extend only their cycle with no catch-up reload burst',async()=>{
  const h=harness(),clicks=[];let time=0;
  h.opts.now=()=>time;h.opts.pause=async ms=>{time+=ms;};h.opts.random=()=>0;
  const snapshot=h.opts.snapshot,click=h.opts.click,save=h.opts.save;
  h.opts.click=async()=>{clicks.push(time);await click();};
  h.opts.snapshot=async()=>({...await snapshot(),loaded:time>=7000});
  h.opts.save=async()=>{time+=900;return save();};
  await collect({...h.opts,count:3});
  assert.ok(clicks[1]-clicks[0]>7000);assert.equal(clicks[2]-clicks[1],5000);
});
test('unchanged image times out without writing or retrying reload',async()=>{
  const h=harness('unchanged');await assert.rejects(collect(h.opts),/No changed/);assert.deepEqual(h.counts(),{clicks:1,saved:0});
});
test('browser disconnection retains its cause instead of appearing as a user stop',async()=>{
  const h=harness();h.abort.abort(new Error('Chrome disconnected capture (target_closed)'));
  await assert.rejects(collect(h.opts),/Chrome disconnected capture \(target_closed\)/);
  assert.deepEqual(h.counts(),{clicks:0,saved:0});
});
test('stop and disk errors prevent subsequent clicks',async()=>{
  for(const mode of ['stop','disk']) {
    const h=harness(mode);await assert.rejects(collect(h.opts));assert.deepEqual(h.counts(),{clicks:1,saved:1});
  }
});
test('saveNext preserves existing files and removes a failed new write',async()=>{
  const files=new Map([['input14.png','original']]);
  let scans=0;
  const dir={async *keys(){scans++;yield*files.keys();},async getFileHandle(name,opts){
    if(!files.has(name)&&!opts?.create)throw new DOMException('Missing','NotFoundError');
    if(!files.has(name))files.set(name,'');
    return {createWritable:async()=>({write:async blob=>{files.set(name,await blob.text());},close:async()=>{},abort:async()=>{}})};
  },removeEntry:async name=>files.delete(name)};
  const signal=new AbortController().signal;
  const save=await createSequentialSaver(dir,signal);
  assert.equal(await save(new Blob(['new']),signal),'input15.png');
  files.set('input16.png','external addition');
  assert.equal(await save(new Blob(['new']),signal),'input17.png');
  assert.equal(files.get('input16.png'),'external addition');
  assert.equal(scans,1);
  assert.equal(files.get('input14.png'),'original');
  const abort=new AbortController();
  const broken={...dir,getFileHandle:async(name,opts)=>{
    const h=await dir.getFileHandle(name,opts);
    if(opts?.create)h.createWritable=async()=>({write:async()=>{throw new Error('Disk full');},abort:async()=>{}});
    return h;
  }};
  const brokenSave=await createSequentialSaver(broken,abort.signal);
  await assert.rejects(brokenSave(new Blob(['x']),abort.signal),/Disk full/);
  assert.equal(files.has('input18.png'),false);
});
