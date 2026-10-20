"""Write-once evidence and deterministic evolution for the isolated masked run."""
import hashlib,json,random,shutil,time,os
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;RUN=ROOT/'work/pepe-finrl-mask-v3'
P=json.loads((ROOT/'pepe-finrl-mask-protocol.json').read_text())
def read(f):return json.loads(Path(f).read_text())
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def atomic(f,value):
 f=Path(f);f.parent.mkdir(parents=True,exist_ok=True);t=f.with_name(f.name+'.tmp');t.write_text(json.dumps(value,separators=(',',':'),ensure_ascii=False,allow_nan=False));t.replace(f)
def immutable_json(f,value):
 f=Path(f);f.parent.mkdir(parents=True,exist_ok=True)
 with f.open('x')as out:json.dump(value,out,separators=(',',':'),ensure_ascii=False,allow_nan=False)
 f.chmod(0o444)
def immutable_copy(source,target):
 target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
 with Path(source).open('rb')as inp,target.open('xb')as out:shutil.copyfileobj(inp,out)
 target.chmod(0o444)
 if sha(source)!=sha(target):raise ValueError('Archive copy hash mismatch')
def audit_score(a):return a['pnlBRL']-P['drawdownPenalty']*a['maxDD']*P['capitalBRL']
def rank(rows,active=False):
 rows=[r for r in rows if not active or r['audit']['count']>0]
 return sorted(rows,key=lambda r:(-audit_score(r['audit']),-r['audit']['pnlBRL'],str(r['id'])))
def compact_result(r):
 return{**r,**{k:({x:y for x,y in r[k].items()if x not in ['trades','curve']}if r.get(k)else None)for k in ['audit','probe']}}
def archive(result,kind,source=None):
 source=Path(source or(ROOT/result['modelPath']));digest=sha(source)
 folder=RUN/'archives'/f"{kind}-g{result['generation']}-a{result['id']}-{digest[:16]}"
 metadata={'kind':kind,'generation':result['generation'],'agent':result['id'],'archivedAt':int(time.time()*1000),'modelSHA256':digest,'modelPath':str((folder/'model.zip').relative_to(ROOT)),'walletInitialBRL':P['capitalBRL'],'cost':P['trainingCost'],'fixedCalendar':P['development'],'probeWindow':result.get('window'),'source':result.get('source'),'hyperparameters':result['hyperparameters'],'seed':result['seed'],'parent':result.get('parent'),'scientificRegistrationSHA256':sha(RUN/'registration.json'),'evaluationPath':str((folder/'evaluation.json').relative_to(ROOT)),'realOrders':False}
 if folder.exists():
  previous=read(folder/'metadata.json')
  if previous['modelSHA256']!=digest or sha(folder/'model.zip')!=digest:raise ValueError('Immutable archive conflict')
  return previous
 folder.mkdir(parents=True);immutable_copy(source,folder/'model.zip');immutable_json(folder/'evaluation.json',result);immutable_json(folder/'metadata.json',metadata)
 return metadata

def hp(rng):return{k:rng.choice(values)for k,values in P['hyperparameters'].items()}
def window(g):
 rng=random.Random(P['globalSeed']+g*104729);from datetime import datetime,timezone
 start=int(datetime.fromisoformat(P['development']['start']+'-01').replace(tzinfo=timezone.utc).timestamp()*1000);end=int(datetime.fromisoformat(P['development']['end']+'-01').replace(tzinfo=timezone.utc).timestamp()*1000)
 a=start+rng.randrange((end-start)//86400000-P['probeDays']+1)*86400000;return{'start':a,'end':a+P['probeDays']*86400000}
def plan_evolution(agents,results,g,stagnation):
 ranked=rank(results);by_id={a['id']:a for a in agents};rng=random.Random(P['globalSeed']+g*7919);parents=ranked[:max(1,int(len(agents)*.2))];parent_ids={a['id']for a in parents};eligible=[r for r in ranked[::-1]if r['id']not in parent_ids and by_id[r['id']]['age']+1>=P['minimumMaturity']];count=min(len(eligible),int(len(agents)*P['replaceFraction']));fresh=min(count,int(len(agents)*(.15 if stagnation>=3 else P['immigrantFraction'])));changes=[]
 for i,row in enumerate(eligible[:count]):
  parent=None if i<fresh else rng.choice(parents);params=hp(rng)if parent is None else dict(parent['hyperparameters'])
  if parent:
   changed=False
   for key,values in P['hyperparameters'].items():
    if rng.random()<(.5 if stagnation>=3 else .25):params[key]=rng.choice([v for v in values if v!=params[key]]);changed=True
   if not changed:
    key=rng.choice(list(params));params[key]=rng.choice([v for v in P['hyperparameters'][key]if v!=params[key]])
  changes.append({'id':row['id'],'parent':parent['id']if parent else None,'fresh':parent is None,'hyperparameters':params,'reason':'Fresh diversity'if parent is None else'Inherited only after same-calendar continuous audit'})
 return{'generation':g,'changes':changes,'immigrants':fresh,'stagnation':stagnation,'parents':parents}
def inventory():
 rows=[]
 for label,base in [('v2-250','work/pepe-finrl-v2'),('v1-1000-partial','work/pepe-finrl-1000-v1')]:
  cp=read(ROOT/base/'checkpoint.json')
  for a in cp['population']:
   f=ROOT/a['modelPath']
   if f.exists():rows.append({'id':f'{label}-current-a{a["id"]}','modelPath':a['modelPath'],'source':{'run':label,'kind':'recoverable-current-policy','completedGeneration':cp['generation'],'agent':a['id'],'warning':'Current weights may reflect final inheritance; not original weights of an earlier probe'},'hyperparameters':a['hyperparameters'],'seed':a['seed']})
  folder=ROOT/base/'candidates'
  for f in sorted(folder.glob('*.zip')):
   ev=ROOT/base/'evaluations'/(f.stem+'.json')
   if not ev.exists():continue
   row=read(ev);rows.append({'id':label+'-'+f.stem,'modelPath':str(f.relative_to(ROOT)),'source':{'run':label,'kind':'immutable-historical-candidate','evaluation':str(ev.relative_to(ROOT))},'hyperparameters':row['hyperparameters'],'seed':P['globalSeed']})
 rows.append({'id':'G830-reconstruction','modelPath':'work/pepe-g830-audit-v1/replayed.zip','source':{'kind':'behavioral-reconstruction','originalWeightsRecovered':False},'hyperparameters':{k:P['ppo'][k]for k in P['hyperparameters']},'seed':P['globalSeed']})
 unique={}
 for row in rows:
  row['sourceSHA256']=sha(ROOT/row['modelPath']);key=row['sourceSHA256']
  if key not in unique:unique[key]={**row,'aliases':[]}
  else:unique[key]['aliases'].append(row['id'])
 return{'registeredAt':int(time.time()*1000),'criterion':'Maximum stress-cost fixed-quarter score among active compatible masked-converted policies; cash baseline separate. No consumed final test read.','wallet':P['capitalBRL'],'calendar':P['development'],'selectionUsesTest':False,'nominalFiles':len(rows),'uniqueFiles':len(unique),'candidates':list(unique.values()),'scope':'All recoverable compatible PEPE PPO files from both populations, immutable candidates and G830 reconstruction. ETH trees/Donchian rule genomes are not compatible neural weights.'}
