import test from 'node:test';
import assert from 'node:assert/strict';
import {watchImageLoads} from '../src/loading.mjs';

test('tracks delayed image and child-frame requests, fails closed, and removes listeners',async()=>{
  const listeners=new Set(),commands=[];
  const original=globalThis.chrome,originalNow=Date.now;
  let time=10000;
  Date.now=()=>time;
  globalThis.chrome={debugger:{
    onEvent:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},
    sendCommand:async(target,method)=>{commands.push({target,method});},
  }};
  const emit=(method,params,source={tabId:42})=>{for(const f of listeners)f(source,method,params);};
  const monitor=watchImageLoads(42);
  try{
    await monitor.prepare();assert.equal(listeners.size,1);
    monitor.begin();time+=600;assert.equal(monitor.ready(),true);
    emit('Network.requestWillBeSent',{requestId:'image',type:'Image'});
    time+=7000;assert.equal(monitor.ready(),false);
    emit('Network.loadingFinished',{requestId:'image'});
    assert.equal(monitor.ready(),false);time+=600;assert.equal(monitor.ready(),true);
    emit('Target.attachedToTarget',{sessionId:'child'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(commands.some(c=>c.target.sessionId==='child'&&c.method==='Network.enable'));
    emit('Network.requestWillBeSent',{requestId:'fetch',type:'Fetch'},{tabId:42,sessionId:'child'});
    time+=600;assert.equal(monitor.ready(),true,'Unrelated frame Fetch/XHR must not stall a loaded image');
    emit('Network.responseReceived',{requestId:'fetch',response:{status:200,mimeType:'image/png'}},{tabId:42,sessionId:'child'});
    assert.equal(monitor.ready(),false,'Fetch response containing an image must finish');
    emit('Network.loadingFailed',{requestId:'fetch',canceled:false},{tabId:42,sessionId:'child'});
    assert.throws(()=>monitor.ready(),/could not finish loading/);
    monitor.dispose();assert.equal(listeners.size,0);
  }finally{monitor.dispose();globalThis.chrome=original;Date.now=originalNow;}
});
