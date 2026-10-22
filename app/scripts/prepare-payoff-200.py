"""Register a 100-generation continuation without editing/stopping the live study."""
import hashlib,json,os,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OLD=ROOT/'work/pepe-payoff-genetic-v1';BASE=ROOT/'work/pepe-payoff-genetic-200-v1'
def read(f):return json.loads(Path(f).read_text())
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def frozen(f,v):
 with Path(f).open('x')as s:json.dump(v,s,ensure_ascii=False,indent=2,allow_nan=False)
 Path(f).chmod(0o444)
def main():
 BASE.mkdir(exist_ok=True)
 if(BASE/'registration.json').exists():return
 reg=read(OLD/'registration.json')
 for f,h in {**reg['sourceHashes'],**reg['inputs']}.items():
  if sha(ROOT/f)!=h:raise ValueError('Frozen parent changed '+f)
 sources={
 'scripts/payoff200_worker.py':('scripts/payoff_genetic_worker.py',{'work/pepe-payoff-genetic-v1':'work/pepe-payoff-genetic-200-v1'}),
 'scripts/audit-payoff200.py':('scripts/audit-payoff-genetic.py',{'payoff_genetic_worker':'payoff200_worker','after all100':'after all200'}),
 'scripts/payoff200-wallet.mjs':('scripts/payoff-genetic-wallet.mjs',{'work/pepe-payoff-genetic-v1':'work/pepe-payoff-genetic-200-v1'}),
 'scripts/run-payoff200.py':('scripts/run-payoff-genetic.py',{'payoff_genetic_worker':'payoff200_worker','payoff-genetic-wallet.mjs':'payoff200-wallet.mjs','audit-payoff-genetic':'audit-payoff200','payoff-genetic.json':'payoff-genetic-200.json','trend-lab-payoff-genetic':'trend-lab-payoff-genetic-200','payoff-genetic-v1':'payoff-genetic-200-v1','/api/payoff-genetic':'/api/payoff-genetic-200','4180':'4182','>=100':'>=200','<100':'<200','==100':'==200'})}
 for output,(source,changes)in sources.items():
  text=(ROOT/source).read_text()
  for a,b in changes.items():text=text.replace(a,b)
  f=ROOT/output
  if f.exists():
   if f.read_text()!=text:raise ValueError('Derived source conflict')
  else:f.write_text(text)
 p={**read(OLD/'protocol.json'),'version':'pepe-payoff-genetic-200-v1','registeredAt':int(time.time()*1000),'generations':200,'continuationFrom':'work/pepe-payoff-genetic-v1','continuationGenerations':100,'continuationRule':'Wait for the original100 plus its immutable audit; resume only its SELECTION checkpoint/population, evolve once for generation100, reuse exact phenotype caches. Discard audit fields from checkpoint. No audit result changes fitness, mutations, ranking or duration.','validation':'After total200, freeze selection genotype and use the unchanged eight-month2024 retrospective audit; original100 audit preserved separately. All history globally consumed.','operations':'No hour limit. Additional100 generations after existing100; maximum9 model workers plus one wallet, same memory/disk guards and pause control.'}
 for d in ['candidates','fits','champions','wallet-cache','grids']: (BASE/d).mkdir(exist_ok=True)
 os.link(OLD/'dataset.json',BASE/'dataset.json')
 frozen(BASE/'protocol.json',p)
 frozen(BASE/'registration.json',{'registeredAt':p['registeredAt'],'protocolSHA256':sha(BASE/'protocol.json'),'inputs':{**reg['inputs'],'work/pepe-payoff-genetic-200-v1/dataset.json':sha(BASE/'dataset.json'),'work/pepe-payoff-genetic-v1/protocol.json':sha(OLD/'protocol.json')},'sourceHashes':{**reg['sourceHashes'],**{f:sha(ROOT/f)for f in sources},'scripts/prepare-payoff-200.py':sha(__file__)}})
 print(json.dumps({'registered':True,'totalGenerations':200,'extraGenerations':100,'currentTrainingUntouched':True}))
if __name__=='__main__':main()
