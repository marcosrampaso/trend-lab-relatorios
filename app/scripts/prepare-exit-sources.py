"""Entry corpus registration is independent of proposed exit targets/rewards."""
import importlib,time,datetime
c=importlib.import_module('pepe-elite-core');ROOT=c.ROOT;RUN=ROOT/'work/pepe-exits-v1'
def main():
 if(RUN/'source-registration.json').exists():raise ValueError('Source corpus already registered')
 if c.read(ROOT/'work/pepe-v4-v2/status.json')['status']!='pilot_complete':raise ValueError('V4 must finish first')
 reg=c.read(ROOT/'work/pepe-finrl-mask-v3/registration.json')
 for p,h in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes']}.items():
  if c.sha(ROOT/p)!=h:raise ValueError('Frozen source changed: '+p)
 old=c.read(ROOT/'work/pepe-v3-final-v1/selection.json');target=RUN/'founder.zip';c.copy_once(ROOT/old['modelPath'],target);months=[]
 for year in [2023,2024]:
  for month in range(1,13):
   label=f'{year}-{month:02}'
   if not '2023-06'<=label<'2024-10'or label=='2024-08':continue
   start=datetime.datetime(year,month,1,tzinfo=datetime.timezone.utc);end=datetime.datetime(year+month//12,month%12+1,1,tzinfo=datetime.timezone.utc)
   months.append({'month':label,'start':int(start.timestamp()*1000),'end':int(end.timestamp()*1000),'split':'train'if label<'2024-04'else'development'})
 p={**c.read(ROOT/'pepe-finrl-mask-protocol.json'),'version':'pepe-exit-source-v1','createdAt':int(time.time()*1000),'seed':2026102105,'founder':{'label':'V3 G91/a245','modelPath':str(target.relative_to(ROOT)),'modelSHA256':c.sha(target)},'months':months,'minimumControllable':{'train':20,'development':20},'sourcePolicyNeverLearns':True,'sourceCorpus':'Independent monthly R$1000 source accounts, original masked actions/costs/risk. Record entry snapshots with only information known before each entry. Source monthly profits must never be compounded.','limitation':'All calendars and the entry generator were already used in previous research. Retrospective exit-management pilot, not independent validation. 2025 validation and September2026 final are excluded.','realOrders':False}
 c.immutable(RUN/'source-protocol.json',p)
 sources=['scripts/prepare-exit-sources.py','scripts/generate-exit-sources.py','scripts/exit-lab-source-bridge.mjs','scripts/pepe-elite-core.py','scripts/pepe-elite-worker.py','scripts/pepe-mask-worker.py','scripts/pepe_mask_env.py','scripts/pepe_finrl_env.py','scripts/pepe-mask-engine.mjs','scripts/pepe-mask-actions.mjs']
 r={'registeredAt':int(time.time()*1000),'protocolSHA256':c.sha(RUN/'source-protocol.json'),'sourceHashes':{**reg['sourceHashes'],**{f:c.sha(ROOT/f)for f in sources}},'dataHashes':reg['dataHashes'],'dependencyHashes':reg['dependencyHashes'],'parentHashes':{p['founder']['modelPath']:p['founder']['modelSHA256']}}
 c.immutable(RUN/'source-registration.json',r);print({'months':len(months),'trainMonths':sum(m['split']=='train'for m in months),'exitTargetsNotDefinedHere':True})
if __name__=='__main__':main()
