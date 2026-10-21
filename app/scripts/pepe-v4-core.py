"""V4: immutable champions, protected updates, temporal development blocks."""
import importlib,statistics,random
shared=importlib.import_module('pepe-elite-core')
ROOT=shared.ROOT;RUN=ROOT/'work/pepe-v4-v1'
read,sha,atomic,immutable,copy_once,compact=shared.read,shared.sha,shared.atomic,shared.immutable,shared.copy_once,shared.compact

def aggregate(blocks,protocol):
 aa=[x['summary']for x in blocks]
 if len(aa)!=len(protocol['fitnessBlocks']):raise ValueError('Incomplete block audit')
 means={k:statistics.mean(a[k]for a in aa)for k in ['pnlBRL','maxDD','grossBRL','feesBRL','slippageBRL','fundingBRL']}
 mean_score=statistics.mean(a['pnlBRL']-protocol['drawdownPenalty']*a['maxDD']*protocol['capitalBRL']for a in aa)
 worst=min(a['pnlBRL']for a in aa);penalty=protocol['worstLossPenalty']*max(0,-worst)
 return{**means,'score':mean_score-penalty,'meanBlockScore':mean_score,'worstBlockPNL':worst,'worstLossPenaltyBRL':penalty,'positiveBlocks':sum(a['pnlBRL']>0 for a in aa),'activeBlocks':sum(a['count']>0 for a in aa),'haltedBlocks':sum(a['halted']for a in aa),'count':sum(a['count']for a in aa),'halted':any(a['halted']for a in aa),'independentWallets':len(aa),'notACompoundedPortfolio':True}

def promote(candidate,incumbent):return shared.promote('protected',candidate,incumbent)

def evolve(agents,best,g,protocol):
 out=[dict(a)for a in agents];events=[]
 if g%protocol['reproduceEvery']==0:
  count=max(1,int(len(out)*protocol['replaceFraction']));rng=random.Random(protocol['seed']+g*7919)
  ranked=sorted(out,key=lambda a:(a['incumbent']['score'],a['id']))
  for a in ranked[:count]:
   if best['score']<a['incumbent']['score']-1e-8:raise ValueError('Reproduction would regress retained fitness')
   old_rate=a['hyperparameters']['learning_rate'];choices=[v for v in protocol['learningRates']if v!=old_rate]
   a['incumbent']=best;a['hyperparameters']={**a['hyperparameters'],'learning_rate':rng.choice(choices)};a['parentGeneration']=g
   events.append({'id':a['id'],'parentModelSHA256':best['modelSHA256'],'oldLearningRate':old_rate,'newLearningRate':a['hyperparameters']['learning_rate'],'reason':'Frozen best parent; mutate only learning rate'})
  by={a['id']:a for a in ranked};out=[by[a['id']]for a in out]
 return out,events
