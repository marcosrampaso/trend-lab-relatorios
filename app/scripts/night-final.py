"""One frozen audit per arm/seed; never pick the best validation seed."""
import importlib,time,statistics
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE

def main():
 c.verify();worker=importlib.import_module('night-worker');from night_env import NightEnv
 chosen=c.read(B/'ppo-selection.json');reference=c.read(B/'benchmarks.json')['validation']['cdi'];rows=[]
 for i,a in enumerate(chosen['champions']):
  out=B/'reports'/f'ppo-final-{i:02}.json'
  if out.exists():row=c.read(out)
  else:
   source=a['models'][6]
   if c.sha(R/source['modelPath'])!=source['modelSHA256']:raise ValueError('Final policy changed')
   env=NightEnv('validation',a['arm'],6)
   try:
    model=worker.load(source['modelPath'],env,a['hyperparameters'],a['seed']);value=worker.evaluate(model,env,a['seed'])
   finally:env.close()
   row={'arm':a['arm'],'island':a['island'],'seed':a['seed'],'modelSHA256':source['modelSHA256'],'summary':value,'cdi':reference,'realOrders':False};c.immutable(out,row)
  rows.append(row)
 arms={arm:{'seeds':len([r for r in rows if r['arm']==arm]),'meanPNL':statistics.mean(r['summary']['pnlBRL']for r in rows if r['arm']==arm),'medianPNL':statistics.median(r['summary']['pnlBRL']for r in rows if r['arm']==arm),'aboveCDI':sum(r['summary']['pnlBRL']>reference['pnlBRL']for r in rows if r['arm']==arm)}for arm in ['original','context']}
 value={'phase':'complete','completedAt':int(time.time()*1000),'rows':rows,'arms':arms,'independentValidation':False,'noValidationFeedback':True,'realOrders':False};c.immutable(B/'reports/ppo-final.json',value);c.atomic(R/'web/data/night-ppo-final.json',value)
if __name__=='__main__':main()
