"""Freeze development shortlist, assess once, never feed results back into learn()."""
import importlib,json,statistics,time,subprocess,shutil
core=importlib.import_module('pepe-v4-v2-core');worker=importlib.import_module('pepe-elite-worker');ROOT,RUN=core.ROOT,core.RUN
from pepe_v4_validation_env import V4ValidationEnv
def choose(candidates,founder,limit=3):
 unique={}
 for r in sorted(candidates,key=lambda r:(-r['score'],r['key'])):
  if r['kind']=='train'and r['modelSHA256']!=founder['modelSHA256']:unique.setdefault(r['modelSHA256'],r)
 selected=[{'label':r['key'],'modelPath':r['modelPath'],'modelSHA256':r['modelSHA256'],'developmentScore':r['score'],'control':False}for r in list(unique.values())[:limit-1]]
 return[*selected,{**founder,'label':'V3 frozen founder','control':True}]
def ranking(r):return(r['worstQuarterExcessCDI'],r['meanQuarterExcessCDI'],-r['meanValidationDD'])
def run():
 p=core.read(RUN/'protocol.json');cp=core.read(RUN/'checkpoint.json');reg=core.read(RUN/'registration.json')
 if cp['generation']!=p['generations']:raise ValueError('Training must finish before opening validation')
 if core.sha(RUN/'protocol.json')!=reg['protocolSHA256']:raise ValueError('Protocol changed')
 for path,h in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes'],**reg['parentHashes']}.items():
  if core.sha(ROOT/path)!=h:raise ValueError('Registered input changed: '+path)
 if(RUN/'validation-report.json').exists():return core.read(RUN/'validation-report.json')
 selection=RUN/'validation-selection.json'
 if not selection.exists():
  candidates=[core.read(f)for f in(RUN/'results').glob('*.json')]
  core.immutable(selection,{'selectedAt':int(time.time()*1000),'candidates':choose(candidates,p['founder'],p['validationCandidateLimit']),'criterion':p['validationShortlist'],'validationUsedForShortlist':False})
 chosen=core.read(selection)['candidates'];results=[]
 env=V4ValidationEnv('validation');continuous=V4ValidationEnv('continuous')
 try:
  for candidate in chosen:
   if core.read(RUN/'control.json')['desired']!='running'or shutil.disk_usage(ROOT).free<10*1024**3:raise InterruptedError('Assessment paused between frozen candidates')
   if core.sha(ROOT/candidate['modelPath'])!=candidate['modelSHA256']:raise ValueError('Shortlisted model changed')
   out=RUN/'validation-results'/(candidate['modelSHA256']+'.json')
   if out.exists():r=core.read(out)
   else:
    model=worker.original.MaskablePPO.load(ROOT/candidate['modelPath'],device='cpu');before=worker.tensor_sha(model);blocks=[]
    for b in p['validationBlocks']:blocks.append({**b,'summary':worker.original.evaluate(model,env,window=b,seed=p['seed'])})
    b=p['continuousAudit'];whole={**b,'summary':worker.original.evaluate(model,continuous,window=b,seed=p['seed'])}
    if worker.tensor_sha(model)!=before or core.sha(ROOT/candidate['modelPath'])!=candidate['modelSHA256']:raise ValueError('Assessment changed model')
    r={'candidate':candidate,'blocks':blocks,'continuous':whole,'completedAt':int(time.time()*1000),'trainingSteps':0,'tensorsUnchanged':True,'registrationSHA256':core.sha(RUN/'registration.json')};core.immutable(out,r)
   if r['registrationSHA256']!=core.sha(RUN/'registration.json'):raise ValueError('Cached assessment mismatch')
   results.append(r)
 finally:env.close();continuous.close()
 # The same immutable rates and complete UTC days used by all other lab charts.
 js="import{read}from'./scripts/multiasset-io.mjs';import{cdiReference}from'./scripts/cdi-reference-core.mjs';const p=read('work/pepe-v4-v2/protocol.json'),rates=read('work/pepe-v4-v2/rates.json');console.log(JSON.stringify(Object.fromEntries([...p.validationBlocks,p.continuousAudit].map(b=>[b.id,cdiReference(rates,b.start,b.end,p.capitalBRL)]))));"
 refs=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT,text=True))
 if not all(r['comparable']for r in refs.values()):raise ValueError('Incomplete CDI benchmark')
 for r in results:
  excess=[b['summary']['pnlBRL']-refs[b['id']]['pnlBRL']for b in r['blocks']];r.update(worstQuarterExcessCDI=min(excess),meanQuarterExcessCDI=statistics.mean(excess),meanValidationDD=statistics.mean(b['summary']['maxDD']for b in r['blocks']))
  quarters=all(b['summary']['pnlBRL']>refs[b['id']]['pnlBRL']and not b['summary']['halted']and b['summary']['maxDD']<=.2 for b in r['blocks']);whole=r['continuous'];a=whole['summary'];r['approved']=quarters and a['pnlBRL']>refs[whole['id']]['pnlBRL']and not a['halted']and a['maxDD']<=.2
 trained=[r for r in results if not r['candidate']['control']];winner=max(trained,key=ranking)if trained else None
 report={'app':'trend-lab-pepe-v4-validation','completedAt':int(time.time()*1000),'results':results,'cdi':refs,'winnerModelSHA256':winner['candidate']['modelSHA256']if winner else None,'anyTrainedApproved':any(r['approved']for r in trained),'criterion':p['validationSelection'],'limitation':p['validationLimitation'],'finalTestLocked':True,'trainingAfterValidation':False,'realOrders':False}
 core.immutable(RUN/'validation-report.json',report);core.atomic(ROOT/'web/data/pepe-v4-validation.json',report);return report
if __name__=='__main__':run()
