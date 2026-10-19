// Explicit isolated fork: never change the registered 250-agent scientific sources.
import fs from 'node:fs';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
process.chdir(ROOT);
const parent='work/pepe-finrl-v2',base='work/pepe-finrl-1000-v1',registrationFile=base+'/registration.json';
if(fs.existsSync(registrationFile)){const r=read(registrationFile);for(const[f,h]of Object.entries({...r.sourceHashes,...r.dataHashes}))if(hash(f)!==h)throw Error('Changed registered 1000-agent input '+f);console.log('1000-agent fork already registered; state preserved');process.exit(0);}
const source=read(parent+'/registration.json');
for(const[f,h]of Object.entries({...source.sourceHashes,...source.dataHashes,...source.dependencies.sourceHashes}))if(hash(f)!==h)throw Error('Parent source/input mismatch '+f);
if(fs.existsSync(parent+'/selection.json'))throw Error('Cannot create this population comparison after inspecting final test');
const protocol={...structuredClone(source.protocol),version:'pepe-finrl-pbt-1000-v1',population:1000,notes:[...source.protocol.notes,'Isolated1000-agent fork: parent250 run remains immutable. Same initial seeds for paired first250 members, market features, actions, risk and dates. Equal-step exploratory POC compares250G200 with1000G50, and250G1000 with1000G250. Fixed-quarter development audits only; one run per population does not establish statistical superiority. New run starts from fresh weights, not selected parent weights.'],selection:source.protocol.selection.replace('250 logical','1000 logical')};
const substitutions=[
 ['scripts/pepe-pbt-core.mjs','scripts/pepe-1000-core.mjs',s=>s.replaceAll('work/pepe-finrl-v2',base)],
 ['scripts/pepe_finrl_env.py','scripts/pepe_1000_env.py',s=>s.replaceAll('pepe-finrl-protocol.json','pepe-finrl-1000-protocol.json').replaceAll('work/pepe-finrl-v2',base).replaceAll('scripts/pepe-finrl-bridge.mjs','scripts/pepe-1000-bridge.mjs')],
 ['scripts/pepe-finrl-bridge.mjs','scripts/pepe-1000-bridge.mjs',s=>s.replaceAll('pepe-finrl-protocol.json','pepe-finrl-1000-protocol.json').replaceAll('work/pepe-finrl-v2',base)],
 ['scripts/pepe-pbt-worker.py','scripts/pepe-1000-worker.py',s=>s.replaceAll('from pepe_finrl_env import','from pepe_1000_env import').replaceAll('work/pepe-finrl-v2',base)],
 ['scripts/evaluate-pepe-finrl.py','scripts/evaluate-pepe-1000.py',s=>s.replaceAll('from pepe_finrl_env import','from pepe_1000_env import').replaceAll('work/pepe-finrl-v2',base)],
 ['scripts/run-pepe-pbt.mjs','scripts/run-pepe-1000.mjs',s=>s.replaceAll('work/pepe-finrl-v2',base).replaceAll("'./pepe-pbt-core.mjs'","'./pepe-1000-core.mjs'").replaceAll('web/data/pepe-finrl.json','web/data/pepe-finrl-1000.json').replaceAll('scripts/pepe-pbt-worker.py','scripts/pepe-1000-worker.py').replaceAll('scripts/evaluate-pepe-finrl.py','scripts/evaluate-pepe-1000.py')]
];
for(const [from,to,transform]of substitutions)fs.writeFileSync(to,'# GENERATED ISOLATED FORK\n'.replace('#',to.endsWith('.py')?'#':'//')+transform(fs.readFileSync(from,'utf8')));
atomic('pepe-finrl-1000-protocol.json',protocol);atomic(base+'/references.json',read(parent+'/references.json'));
const files=[...Object.keys(source.sourceHashes),'pepe-finrl-1000-protocol.json','scripts/prepare-pepe-1000.mjs',base+'/references.json',...substitutions.map(s=>s[1])];
const registration={...source,id:protocol.version,registeredAt:Date.now(),protocol,parentRegistration:{path:parent+'/registration.json',sha256:hash(parent+'/registration.json')},entryModel:'Fresh1000-agent PPO; paired initial seeds; no parent learned weights',sourceHashes:Object.fromEntries(files.map(f=>[f,hash(f)])),comparisonUsesFinalTest:false};
atomic(registrationFile,registration);
const {initialPopulation}=await import('./pepe-1000-core.mjs');const checkpoint={version:protocol.version,generation:0,population:initialPopulation(protocol),trainingSteps:0,activeSeconds:0,stagnation:0,anchors:[],history:[]};atomic(base+'/checkpoint.json',checkpoint);atomic(base+'/control.json',{desired:'paused',mode:'boost',updatedAt:Date.now()});
atomic('web/data/pepe-finrl-1000.json',{app:'trend-lab-pepe-finrl',version:protocol.version,status:'ready',updatedAt:Date.now(),mode:'boost',registration,generation:0,targetGenerations:protocol.generations,population:protocol.population,jobsCompleted:0,completedSteps:0,totalSteps:protocol.population*protocol.generations*protocol.stepsPerGeneration,activeSeconds:0,history:[],anchors:[],developmentPreview:null,ranking:[],selection:null,reference:read(base+'/references.json'),results:[],realOrders:false});
console.log(JSON.stringify({registered:protocol.version,state:'ready',population:1000,simultaneousWorkers:protocol.workers,finalTestOpened:false}));
