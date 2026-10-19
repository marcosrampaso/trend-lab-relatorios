import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {aggregateHours, trendFrames, frameAt, contextAt} from '../web/scalping-context.js';
import {simulateContextScalping} from '../web/scalping-context-engine.js';
import {simulateScalping, MINUTE} from '../web/scalping.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const p=read('scalping-protocol.json'), spec=read('scalping-context-protocol.json');
const HOUR=3600000;
test('contexto4h só aparece no fechamento; agrega OHLC sem atravessar lacunas',()=>{
  const rows=Array.from({length:8},(_,i)=>[i*HOUR,100+i,102+i,99+i,101+i,10]);
  const aggregated=aggregateHours(rows,4);assert.deepEqual(aggregated[0],[0,100,105,99,104,40]);
  const frames=trendFrames(rows,4,{fast:2,slow:3,minimumBars:1});
  assert.equal(frameAt(frames,4*HOUR-1),null);assert.equal(frameAt(frames,4*HOUR).at,4*HOUR);
  assert.equal(frameAt(frames,7*HOUR).at,4*HOUR);
  assert.throws(()=>aggregateHours(rows.filter(r=>r[0]!==HOUR),4),/Lacuna/);
});
test('alterar preços posteriores não altera contexto conhecido nem vetos anteriores',()=>{
  const rows=Array.from({length:1000},(_,i)=>[i*HOUR,100+i,102+i,99+i,101+i,10]);
  const cutoff=800*HOUR+2*MINUTE;
  const poison=rows.map(r=>r[0]+HOUR>cutoff?[r[0],...r.slice(1).map(v=>v*50)]:r);
  const frames=r=>({hourly:trendFrames(r,1,spec.trend),fourHourly:trendFrames(r,4,spec.trend)});
  assert.deepEqual(contextAt(frames(rows),cutoff,1),contextAt(frames(poison),cutoff,1));
  assert.equal(contextAt(frames(rows),cutoff,1).allowed,true);
  assert.equal(contextAt(frames(rows),cutoff,-1).allowed,false);
});
test('veto de entrada nunca remove saída por sinal contrário',()=>{
  const start=Date.parse('2025-04-01T00:00:00Z');
  const candles=Array.from({length:40},(_,i)=>[start+i*MINUTE,2000,2001,1999,2000,10]);
  const data={candles,marks:candles.map(r=>r.slice(0,5)),funding:[],filters:read('web/data/scalping-market.json').filters};
  const signal=(minutes,side)=>({at:start+minutes*MINUTE,side,atr:10,target:null,context:{}});
  const prepared={signals:{cross:[signal(0,1),signal(10,-1),signal(25,-1)]}};
  const frames={hourly:[{at:start,side:1}],fourHourly:[{at:start,side:1}]};
  const opts={strategy:'cross',start,until:start+40*MINUTE,protocol:p,prepared,frames,closeAtEnd:true};
  const r=simulateContextScalping(data,{...opts,mode:'align'});
  assert.equal(r.trades.length,1);assert.equal(r.trades[0].reason,'Sinal contrário');
  assert.equal(r.trades[0].exitAt,start+10*MINUTE);
  assert.ok(!r.events.some(e=>e.kind==='entry'&&e.side===-1));
  assert.ok(r.events.some(e=>e.reason==='Contexto1h/4h veta entrada'));
  assert.deepEqual(simulateContextScalping(data,{...opts,mode:'observe'}),simulateScalping(data,opts));
});
test('96 cenários reproduzem12 controles e conservam caixa, prazo e congelamentos',()=>{
  const r=read('web/data/scalping-context-results.json'),old=read('web/data/scalping-results.json');
  assert.equal(r.scenarios.length,96);assert.equal(r.promoted,false);assert.equal(r.newTraining,false);
  for(const s of r.scenarios){
    assert.ok(Math.abs(s.pnlUSDT-s.trades.reduce((n,t)=>n+t.net,0))<1e-8);
    assert.ok(s.trades.every(t=>t.exitAt-t.entryAt<=s.maxHoldMinutes*MINUTE));
    assert.equal(s.rawSignals,s.acceptedSignals+s.contextVetoes);
    if(s.mode==='align')assert.ok(s.trades.every(t=>contextAt(r.frames,t.signalAt,t.side).allowed));
    if(s.maxHoldMinutes===30&&s.mode==='observe'){
      const b=old.scenarios.find(x=>x.period===s.period&&x.strategy===s.strategy&&x.costCase===s.costCase);
      assert.equal(s.pnlUSDT,b.pnlUSDT);assert.equal(s.count,b.count);
    }
  }
  for(const[file,h]of Object.entries(read('scalping-context-freeze.json').files)){
    const actual=createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex');
    assert.equal(actual,h,file);
  }
});
