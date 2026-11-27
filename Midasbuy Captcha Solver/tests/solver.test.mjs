import test from 'node:test';
import assert from 'node:assert/strict';
import {imagePoint,smoothMove,stagedDrag,validateProposal} from '../src/solver-core.mjs';

function fixture({gain=1,noMovement=false,change=false}={}) {
  let handle=30,piece=32.53,reads=0,releaseCount=0;
  const movements=[],controller=new AbortController();
  const options={distance:135,signal:controller.signal,
    read:async()=>({signature:change && reads++>0?'new':'same',piece:{x:piece,y:50},handle:{x:handle}}),
    press:async()=>{},move:async dx=>{movements.push(dx);handle+=dx;if(!noMovement)piece+=dx*gain;},
    release:async()=>{releaseCount++;}};
  return {options,movements,controller,releases:()=>releaseCount};
}
test('three stages use 20%, 50% of remainder, then final measured remainder',async()=>{
  const f=fixture(),result=await stagedDrag(f.options);
  assert.deepEqual(f.movements,[27,54,54]);assert.equal(result.remaining,0);assert.equal(f.releases(),1);
});
test('fresh DOM feedback corrects a non-1:1 movement ratio',async()=>{
  const f=fixture({gain:.8}),result=await stagedDrag(f.options);
  assert.ok(Math.abs(result.remaining)<.001);assert.equal(result.stages.length,3);
  assert.ok(Math.abs(result.stages[0].handlePerPiece-1.25)<.001);assert.equal(f.releases(),1);
});
test('no movement stops and releases without continuing',async()=>{
  const f=fixture({noMovement:true});await assert.rejects(stagedDrag(f.options),/did not move/);
  assert.equal(f.movements.length,1);assert.equal(f.releases(),1);
});
test('changed challenge stops and releases',async()=>{
  const f=fixture({change:true});await assert.rejects(stagedDrag(f.options),/challenge changed/);assert.equal(f.releases(),1);
});
test('abort during a movement releases before another stage',async()=>{
  const f=fixture(),move=f.options.move;f.options.move=async dx=>{await move(dx);f.controller.abort();};
  await assert.rejects(stagedDrag(f.options),{name:'AbortError'});assert.equal(f.releases(),1);assert.equal(f.movements.length,1);
});
test('uncertain button-down transport still attempts release',async()=>{
  const f=fixture();f.options.press=async()=>{throw Error('transport lost');};
  await assert.rejects(stagedDrag(f.options),/transport lost/);assert.equal(f.releases(),1);
});
test('hold deadline releases even when a movement command stalls',async()=>{
  const f=fixture();f.options.move=()=>new Promise(()=>{});
  await assert.rejects(stagedDrag({...f.options,timeoutMs:25}),/time limit/);
  assert.equal(f.releases(),1);
});
test('elapsed-time motion stays monotonic, lands exactly and skips delayed frames',async()=>{
  let clock=0;const points=[];
  await smoothMove({from:{x:100,y:300},amount:135,signal:new AbortController().signal,durationMs:700,
    now:()=>clock,wait:async ms=>{clock+=ms;},send:async p=>{points.push(p);clock+=60;}});
  assert.ok(clock<850);assert.ok(points.length<15);
  assert.equal(points.at(-1).x,235);assert.ok(points.every(p=>p.y===300));
  assert.ok(points.every((p,i)=>!i || p.x>=points[i-1].x));
});
test('coordinates convert image pixels to CSS pixels at fractional DPR',()=>{
  assert.deepEqual(imagePoint([250,375],{width:500,height:625},{x:50,y:80,width:400,height:500}),{x:250,y:380});
  assert.throws(()=>imagePoint([501,2],{width:500,height:625},{x:0,y:0,width:400,height:500}),/invalid position/);
});
test('uncertainty must be reviewed and incomplete orders never submit',()=>{
  const proposal={format:'B',status:'uncertain',has_proposal:true,confirm_center:[400,430],matches:['A','D','C'].map((candidate,i)=>({order:i+1,candidate,center:[20+i*20,80]}))};
  assert.throws(()=>validateProposal(proposal),/Review/);validateProposal(proposal,true);
  assert.throws(()=>validateProposal({...proposal,matches:proposal.matches.slice(1)},true),/incomplete/);
});
