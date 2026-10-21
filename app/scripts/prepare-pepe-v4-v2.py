"""Immutable revision: inherit the saved V4 boundary and predeclare validation."""
import importlib,time
from pathlib import Path
core=importlib.import_module('pepe-v4-v2-core');ROOT,RUN=core.ROOT,core.RUN
def main():
 if(RUN/'registration.json').exists():raise ValueError('Already registered')
 old=ROOT/'work/pepe-v4-v1';status=core.read(old/'status.json')
 if core.read(old/'control.json')['desired']!='paused'or status['status']!='paused':raise ValueError('Wait for saved V4 pause')
 reg=core.read(old/'registration.json')
 for p,h in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes'],**reg['parentHashes']}.items():
  if core.sha(ROOT/p)!=h:raise ValueError('Frozen input changed: '+p)
 cp=core.read(old/'checkpoint.json');oldp=core.read(old/'protocol.json')
 core.copy_once(ROOT/oldp['founder']['modelPath'],RUN/'founder.zip');founder={**oldp['founder'],'modelPath':str((RUN/'founder.zip').relative_to(ROOT))}
 def block(label,start,end):
  import datetime
  ms=lambda v:int(datetime.datetime.fromisoformat(v+'-01T00:00:00+00:00').timestamp()*1000)
  return {'id':label,'start':ms(start),'end':ms(end)}
 protocol={**oldp,'version':'pepe-v4-v2','createdAt':int(time.time()*1000),'founder':founder,'revisionReason':'User requested quarterly selection, two separate validation quarters, stability and continuous-wallet audit after V4 v1 began. V1 checkpoint and registration preserved.','resumeGeneration':cp['generation'],'validationBlocks':[block('2025-Q3','2025-07','2025-10'),block('2025-Q4','2025-10','2026-01')],'continuousAudit':block('2024-Q4–2025-Q4','2024-10','2026-01'),'validationCandidateLimit':3,'validationShortlist':'After generation 20, freeze the two distinct trained policies with highest development fitness from all completed V4 jobs (including inherited completed v1 jobs), plus the V3 frozen founder as control. Never choose candidates using validation results. Fewer distinct candidates are allowed.','validationSelection':'Evaluate each frozen policy once with stress costs in both validation quarters. Rank lexicographically by worst quarterly excess CDI, then mean excess CDI, then lower mean maximum drawdown. The founder is a control, not a trained-policy winner.','approval':'Both validation quarters must strictly beat same-calendar CDI, with no global halt and max drawdown <=20%; the continuous 15-month wallet must also beat its CDI, have no global halt and max drawdown <=20%. Failure leaves all policies unapproved. No automatic retraining after validation.','validationIndependent':False,'validationLimitation':'These historical quarters were inspected by previous lab studies. They are held out of V4 training/fitness, but not independent untouched evidence. Selection using them consumes them; no parameter feedback or mutation follows their results.','finalTest':'Still locked: register a new prospective period after this selection. September 2026 was consumed by V3 and is excluded entirely.','mutation':oldp['mutation'],'termination':'20 total generations including inherited completed generations, then one registered validation/continuous audit of at most three frozen policies. Pause/error/disk guard. No automatic scale-up, retraining after validation or real orders.'}
 core.immutable(RUN/'protocol.json',protocol);core.copy_once(old/'rates.json',RUN/'rates.json');core.immutable(RUN/'initial-checkpoint.json',cp)
 parent_hashes={founder['modelPath']:founder['modelSHA256']};inherited=[]
 for f in sorted((old/'results').glob('*.json')):
  r=core.read(f)
  if r.get('round',0)>cp['generation']:continue
  core.copy_once(f,RUN/'results'/f.name);parent_hashes[r['modelPath']]=r['modelSHA256'];inherited.append(str((RUN/'results'/f.name).relative_to(ROOT)))
 for a in cp['agents']:
  r=a['incumbent'];parent_hashes[r['modelPath']]=r['modelSHA256']
 sources=['scripts/pepe-v4-v2-core.py','scripts/pepe-v4-v2-worker.py','scripts/pepe_v4_v2_env.py','scripts/pepe-v4-v2-bridge.mjs','scripts/run-pepe-v4-v2.py','scripts/prepare-pepe-v4-v2.py','scripts/evaluate-pepe-v4-v2.py','scripts/pepe-v4-validation-bridge.mjs','scripts/pepe_v4_validation_env.py']
 registration={'registeredAt':int(time.time()*1000),'protocolSHA256':core.sha(RUN/'protocol.json'),'previousRegistrationSHA256':core.sha(old/'registration.json'),'sourceHashes':{**reg['sourceHashes'],**{p:core.sha(ROOT/p)for p in sources}},'dataHashes':{**reg['dataHashes'],str((RUN/'rates.json').relative_to(ROOT)):core.sha(RUN/'rates.json'),str((RUN/'initial-checkpoint.json').relative_to(ROOT)):core.sha(RUN/'initial-checkpoint.json'),**{p:core.sha(ROOT/p)for p in inherited}},'dependencyHashes':reg['dependencyHashes'],'parentHashes':parent_hashes,'inheritedCompletedGenerations':cp['generation'],'ignoredV1PartialJobs':status.get('jobsCompleted',0),'validationDeclaredBeforeEvaluation':True,'V3FinalUsedForFitness':False}
 core.immutable(RUN/'registration.json',registration);core.atomic(RUN/'checkpoint.json',cp);core.atomic(RUN/'control.json',{'desired':'paused','mode':'boost','updatedAt':int(time.time()*1000)})
 state={**status,'status':'registered','phase':'children','pid':None,'jobsCompleted':0,'protocol':protocol,'revision':'v2','error':None,'updatedAt':int(time.time()*1000)};core.atomic(RUN/'status.json',state);core.atomic(ROOT/'web/data/pepe-v4.json',state)
 core.immutable(old/'closure.json',{'closedAt':int(time.time()*1000),'reason':protocol['revisionReason'],'generation':cp['generation'],'partialJobsPreserved':status.get('jobsCompleted',0),'successor':'pepe-v4-v2'})
 print({'registered':True,'resumingGeneration':cp['generation'],'target':20,'validation':['2025-Q3','2025-Q4'],'maximumCandidates':3,'independentValidation':False})
if __name__=='__main__':main()
