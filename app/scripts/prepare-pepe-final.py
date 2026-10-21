"""Freeze one V3 selection before opening its pre-reserved September calendar."""
import importlib,time,subprocess
core=importlib.import_module('pepe-elite-core');ROOT=core.ROOT;RUN=ROOT/'work/pepe-v3-final-v1';V3=ROOT/'work/pepe-finrl-mask-v3'
def main():
 if (RUN/'registration.json').exists():raise ValueError('Final already registered; use evaluator without reselecting')
 state=core.read(V3/'status.json')
 if state['status']!='paused':raise ValueError('Wait for the V3 checkpoint pause')
 cp=core.read(V3/'checkpoint.json');original=core.read(V3/'registration.json')
 for p,digest in {**original['sourceHashes'],**original['dataHashes'],**original['dependencyHashes']}.items():
  if core.sha(ROOT/p)!=digest:raise ValueError('Frozen V3 source changed: '+p)
 archive=cp['bestAudit']['archive'];source=ROOT/archive['modelPath']
 if core.sha(source)!=archive['modelSHA256']:raise ValueError('Archived champion mismatch')
 core.copy_once(source,RUN/'selected-model.zip');selection={'selectedAt':int(time.time()*1000),'criterion':original['protocol']['selection'],'generation':archive['generation'],'agent':archive['agent'],'modelPath':'work/pepe-v3-final-v1/selected-model.zip','modelSHA256':core.sha(RUN/'selected-model.zip'),'archive':archive,'developmentAudit':core.read(ROOT/archive['evaluationPath'])['audit'],'V3CompletedGenerations':cp['generation'],'V3PartialGeneration':state.get('currentGeneration'),'V3PartialJobs':state.get('jobsCompleted'),'stoppedEarlyByUser':True,'selectionUsesFinal':False,'seed':archive['seed']}
 core.immutable(RUN/'selection.json',selection)
 protocol={**original['protocol'],'version':'pepe-v3-final-reserved-september-v1','test':{'start':'2026-09','end':'2026-10','status':'registered_reserved_historical_holdout'},'purpose':'One final evaluation of the frozen V3 development-score champion; no retraining or reselection.','primaryCost':'stress','secondaryCost':'base','oldFinalConsumed':True,'independenceScope':'Reserved September was excluded from every original PEPE feature index and split. Historical holdout, not live prospective trading; one month only.','V4MayUseThisWindowForFitness':False,'automaticPromotion':False,'realOrders':False}
 core.immutable(RUN/'protocol.json',protocol)
 core.copy_once(ROOT/'work/cdi-comparison-v1/rates.json',RUN/'rates.json')
 subprocess.run(['node','scripts/prepare-pepe-final-features.mjs'],cwd=ROOT,check=True)
 from pathlib import Path
 files=['scripts/prepare-pepe-final.py','scripts/prepare-pepe-final-features.mjs','scripts/pepe-final-bridge.mjs','scripts/pepe_final_env.py','scripts/evaluate-pepe-v3-final.py','scripts/report-pepe-v3-final.mjs','scripts/pepe-elite-core.py','scripts/cdi-reference-core.mjs']
 data={**original['dataHashes']}
 for p in [RUN/'protocol.json',RUN/'selection.json',RUN/'selected-model.zip',RUN/'features-index.json',RUN/'2026-09-features.json',ROOT/'data/pepe-finrl-v1/2026-09.json',RUN/'rates.json']:data[str(p.relative_to(ROOT))]=core.sha(p)
 registration={'registeredAt':int(time.time()*1000),'selectionSHA256':core.sha(RUN/'selection.json'),'originalV3RegistrationSHA256':core.sha(V3/'registration.json'),'sourceHashes':{**original['sourceHashes'],**{p:core.sha(ROOT/p)for p in files}},'dataHashes':data,'dependencyHashes':original['dependencyHashes'],'costsDeclaredBeforeEvaluation':['stress','base'],'reservedCalendarAlreadyDeclared':original['protocol']['reserved'],'oneTimeEvaluation':True,'realOrders':False}
 core.immutable(RUN/'registration.json',registration)
 core.immutable(V3/'closure.json',{'closedAt':int(time.time()*1000),'reason':'User chose final evaluation and V4 before reaching original 1000-generation target','completedGenerations':cp['generation'],'partialGeneration':state.get('currentGeneration'),'partialJobs':state.get('jobsCompleted'),'finalSelectionPath':'work/pepe-v3-final-v1/selection.json','finalSelectionSHA256':registration['selectionSHA256']})
 core.atomic(RUN/'status.json',{'status':'registered','selected':selection,'registeredAt':registration['registeredAt'],'realOrders':False})
 print({'registered':True,'generation':selection['generation'],'agent':selection['agent'],'completedV3':cp['generation'],'finalMonth':'2026-09'})
if __name__=='__main__':main()
