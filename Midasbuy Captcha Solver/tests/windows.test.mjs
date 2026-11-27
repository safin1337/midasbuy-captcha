import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('concurrent toolbar opens create one explicit extension window and stale New Tab IDs are not reused',async()=>{
  const state={},windows=new Map();let creates=0;
  const chrome={runtime:{getURL:tail=>'chrome-extension://test/'+tail,onMessage:{addListener(){}}},action:{onClicked:{addListener(){}}},
    storage:{session:{get:async()=>({...state}),set:async value=>Object.assign(state,value),remove:async()=>{}},local:{get:async()=>({})}},
    windows:{get:async id=>{if(!windows.has(id))throw Error('Closed');return windows.get(id);},
      update:async id=>windows.get(id),onRemoved:{addListener(){}},
      create:async options=>{assert.match(options.url,/^chrome-extension:\/\/test\/index.html\?tab=42$/);creates++;await Promise.resolve();const win={id:creates,tabs:[{url:options.url}]};windows.set(win.id,win);return win;}},
  };
  const context=vm.createContext({chrome,console});
  vm.runInContext(await readFile(new URL('../public/background.js',import.meta.url),'utf8'),context);
  const results=await Promise.all([context.openControls({id:42,url:'https://example.test/'}),context.openControls({id:42,url:'https://example.test/'})]);
  assert.equal(creates,1);assert.equal(results[0].id,results[1].id);
  await context.openControls({id:42,url:'https://example.test/'});assert.equal(creates,1);
  windows.set(1,{id:1,tabs:[{url:'chrome://newtab/'}]});
  await context.openControls({id:42,url:'https://example.test/'});assert.equal(creates,2);
});
