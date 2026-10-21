// Read-only scientific inputs; this process only publishes display metadata.
import fs from 'node:fs';
import {ROOT,read,atomic} from './multiasset-io.mjs';
const base=ROOT+'/work/pepe-specialists-v1',p=read(base+'/protocol.json');
function report(){
  const histories={},metrics={};
  for(const j of p.jobs){const dir=base+'/models/'+j.key;
    histories[j.key]=Array.from({length:p.genetic.generations},(_,i)=>dir+'/generation-'+i+'.json')
      .filter(f=>fs.existsSync(f)).map(f=>{const v=read(f);return{generation:v.generation,fitness:v.fitness};});
    if(fs.existsSync(dir+'/metrics.json'))metrics[j.key]=read(dir+'/metrics.json');
  }
  const counts=p.months.map(m=>{const f=base+'/labels/'+m.month+'.json';
    if(!fs.existsSync(f))return{month:m.month,split:m.split,rows:0};
    const rows=read(f).rows;return{month:m.month,split:m.split,rows:rows.length,
      boundaryOutcomes:rows.filter(r=>r.boundary).length,unfilled:rows.filter(r=>r.filled===false).length};
  });
  atomic(ROOT+'/web/data/specialists-progress.json',{protocol:p,histories,metrics,counts,updatedAt:Date.now()});
}
report();
