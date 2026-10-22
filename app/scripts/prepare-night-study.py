"""Predeclare the whole chain before the source's100/200 final results."""
import importlib,time,sys
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE
from datetime import datetime,timezone
ms=lambda m:int(datetime.strptime(m,'%Y-%m').replace(tzinfo=timezone.utc).timestamp()*1000)
def draft():
 B.mkdir(exist_ok=True)
 for d in ['grids','context','models','results','generations','paper','reports','recent']:(B/d).mkdir(exist_ok=True)
 if(B/'protocol.json').exists():return c.read(B/'protocol.json')
 old=c.read(R/'pepe-finrl-mask-protocol.json')
 quarters=[('2024-Q4','2024-10','2025-01'),('2025-Q1','2025-01','2025-04'),('2025-Q2','2025-04','2025-07'),('2025-Q3','2025-07','2025-10'),('2025-Q4','2025-10','2026-01'),('2026-Q1','2026-01','2026-04'),('2026-Q2','2026-04','2026-07')]
 p={'version':'pepe-night-v1','registeredAt':int(time.time()*1000),'source100':'work/pepe-payoff-genetic-v1','source200':'work/pepe-payoff-genetic-200-v1','population':250,'arms':['original','context'],'islandsPerArm':5,'membersPerIsland':25,'seed':20261022,'generations':1000,'stepsPerGeneration':1024,'evaluateEvery':28,'maximumWorkers':5,'threadsPerWorker':2,'maxWallHours':None,'minimumFreeGiB':5,'minimumReclaimableMiB':1400,
 'folds':[{'id':i,'name':label,'trainStart':ms('2023-06'),'trainEnd':ms(a),'start':ms(a),'end':ms(b)}for i,(label,a,b)in enumerate(quarters)],'validation':{'name':'2026-Q3','start':ms('2026-07'),'end':ms('2026-10')},
 'engine':{**old,'version':'pepe-night-ppo-v1','observationCount':51,'train':{'start':'2023-06','end':'2026-04'},'development':{'start':'2024-10','end':'2026-07'},'policyNetwork':[32,32],'allowedLeverages':[10,15]},
 'ppo':{'n_steps':1024,'batch_size':256,'n_epochs':3,'learning_rate':.0003,'gamma':.99,'gae_lambda':.95,'clip_range':.2,'ent_coef':.01,'target_kl':.01},
 'hyperparameters':{'learning_rate':[.0001,.0003,.0005],'ent_coef':[.005,.01,.02],'gamma':[.99,.995],'clip_range':[.1,.2]},
 'hypothesis':'Compare paired original51-padding versus selected-context51 MaskablePPO. Both use identical fresh32x32 policy architecture, seeds, training budget, state masks, reward,costs,risk and original agent-controlled exits. Context comprises selected19 feature groups and8 frozen calibrated payoff-reference components, available only afterMarch2024. No probability entry veto, no forced trades.',
 'chronology':'Seven separate policy states per logical agent, one per chronological fold. Fold train reset samples only full7day episodes strictly before that fold selection start, excludingAug2024. One fold is updated per generation cyclically. Every28 generations, evaluate ALL seven policies in their own three-month continuous wallet before breeding. The21 monthly increments become SELECTION data. No future fold policy is transferred backward; parents transfer only matching fold models.',
 'selection':'Fitness=median of21 monthly netPNL-CDI contributions minus0.25 populationSD of those excesses minus0.25*1000*maximum quarterlyDD. Include months after global halt and zero-trade months. Keep median,mean,worst month,CDI,diversity visible. Never optimize population median by rewarding trades. Selection score is not prospective evidence.',
 'pbt':'Five independent seed islands per arm,25 policies each. Every28 generations replace bottom5 of each island from its own top5, one new immigrant (two after four stale evaluations), mutate one registered hyperparameter. Immutable retained champions are not overwritten by learning. No cross-arm or cross-island copying. Hyperparameter mutations cannot alter costs,risk,exits or action validity.',
 'final':'At1000, freeze one champion per arm/seed island (10 policies). Evaluate each LAST chronological fold policy once inJuly-Sept2026. Report every seed and arm mean/median, not just best seed. These calendars were globally inspected; final audit is retrospective held out of this run selection, not independent untouched evidence. No follow-on tuning based on this audit.',
 'geneticAudit':'Continue unchanged genotype selection to total200. Afterwards evaluate frozen200 model on every eligible installed monthMarch2024-Sept2026 and a continuousSep2024-Sept2026 wallet with no monthly restarts. June2023-Feb2024 are training/calibration, not out-of-sample. August2024 excluded due to missing mark minutes. No new champion chosen from audit.',
 'paper':'After audit, follow the total200 fixed-exit reference in a separate R$1000 prospective paper ledger,15x,risk1%,stress costs. Record decision before scheduled next-minute entry. No backfilling missed signals or actual exchange orders. Public Binance market endpoints only; network failures leave paper waiting and do not stop offline PPO. Weights immutable, no online retraining. CDI current publication may be provisional/unavailable.',
 'queue':['Wait for original100 and its original audit','Continue from checkpoint to total200 without changing fitness','Freeze200 model; audit expanded history and generate report','Start prospective paper monitoring and the paired MaskablePPO population concurrently'],
 'limitations':['Neither MaskablePPO nor context support has demonstrated reliable profit or superiority.','Payoff probabilities refer to fixed reference exits, not the PPO action policy.','The original V3G91 had+319.77 in55 trades in its selected quarter and negative final results. Historical weights are reference only; all new policies start fresh to avoid importing their future exposure.','One thousand generations can take days or more; no overnight completion promise. Seven folds make a generation more expensive; copied/cache results are labeled.'],
 'realOrders':False,'automaticPromotion':False,'independentValidation':False}
 c.atomic(B/'protocol.json',p);return p
if __name__=='__main__':
 p=draft()
 if '--register'in sys.argv:
  if(B/'registration.json').exists():raise ValueError('Already registered')
  source=['scripts/night-core.py','scripts/prepare-night-study.py','scripts/night-grids.mjs','scripts/night-context.py','scripts/night-benchmarks.mjs','scripts/night-smoke.py','scripts/night-final.py','scripts/night-infer.py','scripts/night-bridge.mjs','scripts/night_env.py','scripts/night-worker.py','scripts/run-night-ppo.py','scripts/night-audit.mjs','scripts/night-paper.mjs','scripts/night-feature-core.mjs','scripts/night-control.py','scripts/run-night-chain.py','scripts/export-genetic-replay.mjs','tests/test_night.py','tests/night-features.test.mjs']
  inputs=['work/pepe-payoff-genetic-v1/protocol.json','work/pepe-payoff-genetic-200-v1/protocol.json','work/pepe-v3-final-v1/features-index.json','data/pepe-finrl-v1/exchange.json','work/pepe-exits-v1/rates.json','scripts/pepe-mask-engine.mjs','scripts/pepe-mask-actions.mjs','scripts/specialist-core.mjs','scripts/protection-gate-core.mjs','scripts/protection-gate-engine.mjs','scripts/cdi-reference-core.mjs','scripts/donchian-research-summary-v4.mjs','scripts/payoff200_worker.py','scripts/run-payoff200.py']
  idx=c.read(R/'work/pepe-v3-final-v1/features-index.json')
  for m in idx['months']:
   inputs.extend([m['path'],m['rawPath']])
  inputs.append('data/pepe-finrl-v1/manifest.json');raw=c.read(R/'data/pepe-finrl-v1/manifest.json');inputs.extend(m['path']for m in raw['months']if m['month']=='2023-05');deps=c.read(R/'work/pepe-finrl-mask-v3/registration.json')['dependencyHashes'];ancestor=c.read(R/'work/pepe-payoff-genetic-200-v1/registration.json');deps={**deps,**ancestor['inputs'],**ancestor['sourceHashes']}
  c.immutable(B/'registration.json',{'registeredAt':int(time.time()*1000),'protocolSHA256':c.sha(B/'protocol.json'),'sources':{f:c.sha(R/f)for f in source},'inputs':{**{f:c.sha(R/f)for f in set(inputs)},**deps}})
  (B/'protocol.json').chmod(0o444);c.atomic(B/'control.json',{'desired':'running','mode':'ultra','maxWallHours':None})
 print({'version':p['version'],'registered':(B/'registration.json').exists(),'folds':len(p['folds'])})
