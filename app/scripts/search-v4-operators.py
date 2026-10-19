"""V4 genetic operators with a registered champion-centered first generation."""
import copy,hashlib,importlib.util,json,math,random
from collections import Counter
from pathlib import Path
spec=importlib.util.spec_from_file_location('original_genetic_operators',Path(__file__).with_name('adaptive-genetic.py'));old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
REGIMES=old.REGIMES
identify,rank_key=old.identify,old.rank_key
def behavior_key(row):
 values=[]
 for block in row.get('metrics',[]):
  for month in block.get('months',[]):
   values.append([month['month'],*[round(month[c][k],8) for c in ['base','stress'] for k in ['pnlUSDT','count','maxDD']]])
 return hashlib.sha256(json.dumps(values or row['genome']['id'],sort_keys=True).encode()).hexdigest()
def unique_ranked(candidates):
 return sorted({r['genome']['id']:r for r in candidates}.values(),key=rank_key,reverse=True)
def diverse_pool(candidates,n):
 ranked=unique_ranked(candidates)
 if not ranked:return []
 groups={};behaviors=set()
 for r in ranked:
  key=(r['genome']['algorithm'],behavior_key(r))
  if key in behaviors:continue
  behaviors.add(key);groups.setdefault(r['genome']['algorithm'],[]).append(r)
 selected=[ranked[0]];seen={ranked[0]['genome']['id']}
 while len(selected)<n:
  changed=False
  for group in groups.values():
   while group and group[0]['genome']['id'] in seen:group.pop(0)
   if group:
    r=group.pop(0);selected.append(r);seen.add(r['genome']['id']);changed=True
    if len(selected)==n:break
  if not changed:break
 return selected
def parent_pool(state,p,rng,restart=False):
 candidates=[*state.get('searchArchive',[]),*state['population']]
 if state.get('best'):candidates.append(state['best'])
 ranked=unique_ranked(candidates);selected=[];seen=set();behaviors=set()
 def add(r):
  key=(r['genome']['algorithm'],behavior_key(r))
  if r['genome']['id'] not in seen and key not in behaviors:selected.append(r);seen.add(r['genome']['id']);behaviors.add(key)
 if state.get('best'):add(state['best'])
 for algorithm in p['algorithms']:
  group=[r for r in ranked if r['genome']['algorithm']==algorithm]
  if group:add(group[0])
 extras=unique_ranked(state['population']) if restart else ranked
 if restart:rng.shuffle(extras)
 for r in extras:
  if len(selected)>=p['eliteCount']:break
  add(r)
 return selected[:p['eliteCount']]
def fine_mutation(parent,rng,p):
 g=copy.deepcopy(parent);g.pop('id',None);gene=rng.choice(['threshold','threshold','threshold','volatilityCut','trendCut','hold','family','parameter'])
 if gene=='threshold':
  active=[k for k in REGIMES if g['routes'][k]['family']];arm=g['routes'][rng.choice(active or REGIMES)];arm['threshold']=round(min(.85,max(.2,arm['threshold']+rng.choice([-1,1])*rng.choice([.001,.002,.005,.01,.02,.04]))),3)
 elif gene=='volatilityCut':g[gene]=round(min(.006,max(.0004,g[gene]*math.exp(rng.gauss(0,.06)))),6)
 elif gene=='trendCut':g[gene]=round(min(3,max(.2,g[gene]+rng.gauss(0,.07))),3)
 elif gene=='hold':g['routes'][rng.choice(REGIMES)]['hold']=rng.choice(p['holdingMinutes'])
 elif gene=='family':g['routes'][rng.choice(REGIMES)]['family']=rng.choice([*p['families'],None])
 else:
  a=g['algorithm'];q=g['params']
  if a=='logistic':q['C']=min(100,max(.0001,q['C']*math.exp(rng.gauss(0,.15))))
  elif a in ['tree','random_forest','extra_trees']:
   k=rng.choice(['max_depth','min_samples_leaf']+(['n_estimators'] if a!='tree' else []))
   if k=='n_estimators':q[k]=max(200,min(1600,q[k]+rng.choice([-200,-100,100,200])))
   elif k=='max_depth':q[k]=max(2,min(16,(q[k] or 8)+rng.choice([-1,1])))
   else:q[k]=max(30,min(300,q[k]+rng.choice([-10,-5,5,10])))
  elif a=='hist_boosting':
   k=rng.choice(['l2_regularization','min_samples_leaf','max_iter','max_leaf_nodes'])
   if k=='l2_regularization':q[k]=min(100,max(.01,q[k]*math.exp(rng.gauss(0,.15))))
   elif k=='min_samples_leaf':q[k]=max(30,min(300,q[k]+rng.choice([-10,-5,5,10])))
   elif k=='max_iter':q[k]=max(100,min(1000,q[k]+rng.choice([-25,25])))
   else:q[k]=rng.choice([7,15,31,63])
  else:
   k=rng.choice(['alpha','learning_rate_init']);bounds=(.00001,5) if k=='alpha' else (.0001,.01);q[k]=min(bounds[1],max(bounds[0],q.get(k,.001)*math.exp(rng.gauss(0,.15))))
 if all(a['family'] is None for a in g['routes'].values()):g['routes'][rng.choice(REGIMES)]['family']=rng.choice(p['families'])
 return identify(g)
def generic_generation(state,p,generation):
 rng=random.Random(p['seed']+generation);burst=state['stagnation']>=p['burstAfter'];restart=state['stagnation']>0 and state['stagnation']%p['restartAfter']==0;pool=parent_pool(state,p,rng,restart)
 lanes=p['restartLanes'] if restart else p['burstLanes'] if burst else p['lanes'];children=[];seen=set(state['seen']);origins={};counts={}
 for lane,count in lanes.items():
  actual=0
  for attempt in range(100000):
   if actual>=count:break
   if lane=='local':
    near=state['best']['genome'] if state.get('best') and actual%2==0 else rng.choice(pool[:min(4,len(pool))])['genome'];g=fine_mutation(near,rng,p)
   elif lane=='immigrant':
    g=old.random_genome(rng,p);a=p['algorithms'][(generation+actual)%len(p['algorithms'])];g['algorithm']=a;g['params']=old.default_params(a,rng);g=identify(g)
   elif lane=='crossover':
    algorithm=p['algorithms'][(generation+actual)%len(p['algorithms'])];island=[r for r in pool if r['genome']['algorithm']==algorithm];a=rng.choice(island or pool)['genome'];b=rng.choice(pool)['genome'];g=old.mutate(old.crossover(a,b,rng),rng,p,False)
   else:
    a=pool[actual%len(pool)]['genome'];g=old.mutate(a,rng,p,True)
   if g['id'] in seen:continue
   children.append(g);seen.add(g['id']);origins[g['id']]=lane;actual+=1
  if actual!=count:raise ValueError('Não foi possível completar a pista '+lane)
  counts[lane]=actual
 if len(children)!=p['populationSize']:raise ValueError('Tamanho de população incorreto')
 return children,{'burst':burst,'restart':restart,'immigrants':counts.get('immigrant',0),'origins':origins,'lanes':counts,'parentAlgorithms':dict(Counter(r['genome']['algorithm'] for r in pool)),'parentIds':[r['genome']['id'] for r in pool],'parentDistinctBehaviors':len({behavior_key(r) for r in pool})}

def initial_variants(champion,p):
 variants=[];seen={champion['id']}
 def add(g,parameter):
  g=identify(g)
  if g['id'] not in seen:variants.append((g,parameter));seen.add(g['id'])
 for regime in ['trend','volatile','range']:
  for delta in [-.02,-.01,-.005,-.002,.002,.005,.01,.02]:
   g=copy.deepcopy(champion);g['routes'][regime]['threshold']=round(min(.85,max(.2,g['routes'][regime]['threshold']+delta)),3);add(g,'routes.'+regime+'.threshold')
 for key,deltas in [('trendCut',[-.1,-.05,-.025,.025,.05,.1]),('volatilityCut',[-.0002,-.0001,-.00005,.00005,.0001,.0002])]:
  for delta in deltas:
   g=copy.deepcopy(champion);g[key]=round(g[key]+delta,6 if key=='volatilityCut' else 3);add(g,key)
 for key,values in [('max_depth',[6,8,12,14]),('min_samples_leaf',[60,75,125,150,200]),('n_estimators',[600,800,1000,1400,1600])]:
  for value in values:
   g=copy.deepcopy(champion);g['params'][key]=value;add(g,'params.'+key)
 for regime,holds in [('trend',[60,240,720,1440]),('volatile',[60,120,720,1440])]:
  for hold in holds:
   g=copy.deepcopy(champion);g['routes'][regime]['hold']=hold;add(g,'routes.'+regime+'.hold')
 for value in [6,12]:
  g=copy.deepcopy(champion);g['trainMonths']=value;add(g,'trainMonths')
 # Exact historical alternative, scored again if sampled; it is not automatically promoted.
 g=copy.deepcopy(champion);g['algorithm']='tree';g['params']={'max_depth':2,'min_samples_leaf':144};add(g,'algorithm:historical_tree')
 return variants

def next_generation(state,p,generation):
 if generation!=1:return generic_generation(state,p,generation)
 variants=initial_variants(state['baseline']['genome'],p);children=[g for g,_ in variants[:p['populationSize']]];origins={g['id']:q for g,q in variants[:p['populationSize']]};rng=random.Random(p['seed']+generation)
 while len(children)<p['populationSize']:
  g=old.random_genome(rng,p)
  if g['id'] not in {a['id'] for a in children}|set(state['seen']):children.append(g);origins[g['id']]='immigrant'
 return children,{'burst':False,'restart':False,'immigrants':sum(q=='immigrant' for q in origins.values()),'origins':origins,'lanes':{'registered_ablation':len(variants[:p['populationSize']]),'immigrant':max(0,p['populationSize']-len(variants))},'parentAlgorithms':{state['baseline']['genome']['algorithm']:1},'parentDistinctBehaviors':1,'plan':'Uma coordenada por variante; plano completo registrado eminitial-variants.json. Não usa teste final.'}
