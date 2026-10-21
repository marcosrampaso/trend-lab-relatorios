"""Register the bounded V4 pilot before founder diagnostics and child training."""
import importlib,time,datetime
core=importlib.import_module('pepe-v4-core');ROOT,RUN=core.ROOT,core.RUN
def block(label,start,end):
 def ms(v):return int(datetime.datetime.fromisoformat(v+'-01T00:00:00+00:00').timestamp()*1000)
 return {'id':label,'start':ms(start),'end':ms(end)}
def main():
 if (RUN/'registration.json').exists():raise ValueError('Already registered; resume instead')
 old=ROOT/'work/pepe-finrl-mask-v3';final=ROOT/'work/pepe-v3-final-v1'
 if core.read(old/'control.json')['desired']!='paused' or not(old/'closure.json').exists():raise ValueError('V3 must be closed at its saved checkpoint')
 if core.read(final/'status.json')['status']!='complete':raise ValueError('Complete V3 final test first')
 reg=core.read(old/'registration.json')
 for p,h in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes']}.items():
  if core.sha(ROOT/p)!=h:raise ValueError('Frozen input changed: '+p)
 selection=core.read(final/'selection.json');target=RUN/'founder.zip';core.copy_once(ROOT/selection['modelPath'],target)
 if core.sha(target)!=selection['modelSHA256']:raise ValueError('Founder differs from pre-final V3 selection')
 founder={'label':'V3 G91 / agente 245','generation':selection['generation'],'agent':selection['agent'],'modelPath':str(target.relative_to(ROOT)),'modelSHA256':selection['modelSHA256'],'hyperparameters':selection['archive']['hyperparameters'],'selectionUsesV3Final':False}
 policy=core.read(ROOT/'pepe-finrl-mask-protocol.json')
 protocol={**policy,'version':'pepe-v4-v1','createdAt':int(time.time()*1000),'founder':founder,'population':25,'generations':20,'seed':2026102104,'stepsPerGeneration':1024,'threadsPerWorker':2,'workers':3,'ecoWorkers':1,'maximumWorkers':5,'cost':'stress','learningRates':[1e-6,1e-5,3e-5,1e-4,3e-4],'reproduceEvery':5,'replaceFraction':0.2,'worstLossPenalty':0.25,'fitnessBlocks':[block('2024-Q4','2024-10','2025-01'),block('2025-Q1','2025-01','2025-04'),block('2025-Q2','2025-04','2025-07')],'diagnosticTrainBlocks':[block('2023-Q4','2023-10','2024-01'),block('2024-Q1','2024-01','2024-04'),block('2024-Q2','2024-04','2024-07')],'fitness':'Mean(net BRL - 0.25 * maxDD * 1000) across three development quarters, minus 0.25 * max(0, -worst quarter net BRL). Independent R$1000 wallets; never sum as compounded return. Cash is valid.','adoption':'Train copies; strictly higher aggregate score replaces the incumbent. Champions and rejected candidate weights/receipts are immutable.','mutation':'Five LR cohorts with five seeds each. Every fifth generation, the worst five retained agents copy the frozen best and choose another registered learning rate. No other hyperparameter mutation.','diagnostic':'Evaluate the same frozen founder once in three training quarters, separately from fitness. Descriptive only; no formal PBO or underfitting diagnosis. Training returns may be poor from optimization failure, costs, no signal or underfitting; regime changes confound period comparisons.','developmentStatus':'All three development quarters were consumed previously. Repeated selection here remains susceptible to overfitting; this is not independent validation.','test':None,'finalTest':'Locked. September 2026 was consumed by the closed V3 final and is forbidden for V4 selection. Register a fresh future calendar after freezing V4 selection.','termination':'20 generations, manual pause/error or disk below 10 GiB. No automatic extension, risk changes or real orders.','realOrders':False}
 core.immutable(RUN/'protocol.json',protocol)
 core.copy_once(final/'rates.json',RUN/'rates.json')
 sources=['scripts/pepe-v4-core.py','scripts/pepe-v4-worker.py','scripts/pepe_v4_env.py','scripts/pepe-v4-bridge.mjs','scripts/run-pepe-v4.py','scripts/prepare-pepe-v4.py','scripts/pepe-elite-worker.py','scripts/pepe-elite-core.py','scripts/run-pepe-mask-ultra.py']
 registration={'registeredAt':int(time.time()*1000),'protocolSHA256':core.sha(RUN/'protocol.json'),'sourceHashes':{**reg['sourceHashes'],**{p:core.sha(ROOT/p)for p in sources}},'dataHashes':{**reg['dataHashes'],str((RUN/'rates.json').relative_to(ROOT)):core.sha(RUN/'rates.json')},'dependencyHashes':reg['dependencyHashes'],'parentHashes':{founder['modelPath']:founder['modelSHA256']},'founderSelectionSHA256':core.sha(final/'selection.json'),'V3FinalUsedForFitness':False}
 core.immutable(RUN/'registration.json',registration)
 core.atomic(RUN/'checkpoint.json',{'generation':0,'baseline':None,'trainDiagnostic':None,'best':None,'agents':[],'history':[]})
 core.atomic(RUN/'control.json',{'desired':'paused','mode':'boost','updatedAt':int(time.time()*1000)})
 status={'app':'trend-lab-pepe-v4','status':'registered','phase':'auditing_founder','generation':0,'currentGeneration':1,'population':25,'jobsCompleted':0,'protocol':protocol,'history':[],'registeredAt':registration['registeredAt'],'realOrders':False}
 core.atomic(RUN/'status.json',status);core.atomic(ROOT/'web/data/pepe-v4.json',status)
 print({'registered':True,'population':25,'generations':20,'founder':founder['label'],'trainingDiagnosticBlocks':3,'fitnessBlocks':3})
if __name__=='__main__':main()
