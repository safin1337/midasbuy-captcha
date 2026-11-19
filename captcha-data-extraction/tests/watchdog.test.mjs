import test from 'node:test';
import assert from 'node:assert/strict';
import {viewport} from '../src/browser.mjs';

test('a stalled page command becomes a visible error after eight seconds',async t=>{
  const original=globalThis.chrome;
  globalThis.chrome={scripting:{executeScript:()=>new Promise(()=>{})}};
  t.mock.timers.enable({apis:['setTimeout']});
  try{
    const result=viewport(42);
    t.mock.timers.tick(8000);
    await assert.rejects(result,/Page position check did not respond within 8 seconds/);
  }finally{globalThis.chrome=original;t.mock.timers.reset();}
});
