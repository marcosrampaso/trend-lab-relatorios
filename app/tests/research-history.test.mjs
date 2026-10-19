import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import {createHistoryReader} from '../local/research-history.mjs';
test('catalog route reads only registered files, supports paging and checks bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'history-reader-'));try{
  fs.mkdirSync(path.join(root,'data/history-v2'),{recursive:true});const candles=Array.from({length:10},(_,i)=>[i*60000,1,2,.5,1.5,10,15,4]),bytes=gzipSync(JSON.stringify({candles}));fs.writeFileSync(path.join(root,'data/history-v2/test.gz'),bytes);
  const m={symbol:'ETHUSDT',snapshotEnd:600000,intervals:{'1m':1},months:[{month:'2020-01',complete:true,minutes:10,alignedMinutes:10,candleGaps:[],markGaps:[],frames:{'1m':{path:'data/history-v2/test.gz',sha256:createHash('sha256').update(bytes).digest('hex'),encoding:'gzip',intervalMinutes:1}}}]};
  fs.writeFileSync(path.join(root,'data/history-v2/manifest.json'),JSON.stringify(m));const query=createHistoryReader(root),first=query(new URLSearchParams({month:'2020-01',interval:'1m',limit:'3'}));assert.deepEqual(first.candles.map(r=>r[0]),[420000,480000,540000]);assert.ok(first.hasEarlier);const previous=query(new URLSearchParams({month:'2020-01',interval:'1m',limit:'3',before:String(first.previousBefore)}));assert.deepEqual(previous.candles.map(r=>r[0]),[240000,300000,360000]);assert.ok(previous.hasLater);
  assert.throws(()=>query(new URLSearchParams({interval:'../../.local/runtime.sqlite'})));assert.throws(()=>query(new URLSearchParams({limit:'99999'})));
  assert.equal(query(new URLSearchParams({mode:'catalog'})).months.length,1);
  m.months[0].frames['1m'].sha256='bad';fs.writeFileSync(path.join(root,'data/history-v2/manifest.json'),JSON.stringify(m));assert.throws(()=>query(new URLSearchParams({month:'2020-01'})),/não disponível/);assert.throws(()=>query(new URLSearchParams({month:'2020-01',interval:'1m'})),/Checksum/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
