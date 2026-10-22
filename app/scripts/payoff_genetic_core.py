"""Genetic operators and explicit robust selection objective; no IO or live orders."""
import hashlib,json,math,statistics

SPACE={'learning_rate':[.03,.05,.08],'max_iter':[48,80,128],'max_leaf_nodes':[3,7,15],'max_depth':[2,3,4],'min_samples_leaf':[50,100,200],'l2_regularization':[1,10,30]}
GROUPS=[[0,5,11],[1],[2,6,12,14],[3,13],[4],[7,8,9,10],[15,16,17,18]]
def founder():return {'groups':127,'learning_rate':.05,'max_iter':80,'max_leaf_nodes':7,'max_depth':3,'min_samples_leaf':100,'l2_regularization':10}
def validate(g):
    if set(g)!=set(SPACE)|{'groups'} or not isinstance(g['groups'],int) or not 1<=g['groups']<=127:raise ValueError('Invalid genome')
    if any(g[k] not in values for k,values in SPACE.items()):raise ValueError('Unregistered hyperparameter')
    return g
def identity(g):return hashlib.sha256(json.dumps(validate(g),sort_keys=True,separators=(',',':')).encode()).hexdigest()[:20]
def columns(g):return sorted(i for k,group in enumerate(GROUPS) if g['groups']&(1<<k) for i in group)
def random_genome(rng):return {'groups':rng.randint(1,127),**{k:rng.choice(v) for k,v in SPACE.items()}}
def mutate(g,rng,rate=.2):
    out=dict(g)
    for k,values in SPACE.items():
        if rng.random()<rate:out[k]=rng.choice([v for v in values if v!=out[k]])
    for bit in range(7):
        if rng.random()<rate:out['groups']^=1<<bit
    if not out['groups']:out['groups']=1<<rng.randrange(7)
    if out==g:
        k=rng.choice(list(SPACE));out[k]=rng.choice([v for v in SPACE[k] if v!=out[k]])
    return validate(out)
def score(wallets,genome):
    if len(wallets)!=4:raise ValueError('Four chronological selection wallets required')
    excess=[w['pnlBRL']-w['cdi']['pnlBRL'] for w in wallets]
    if not all(math.isfinite(x) for x in excess):raise ValueError('Invalid return')
    dd=max(w['maxDD'] for w in wallets)*1000
    value=statistics.median(excess)-.25*statistics.pstdev(excess)-.25*dd-.001*len(columns(genome))
    trades=sum(w['count'] for w in wallets)
    return {'fitness':value,'medianExcessBRL':statistics.median(excess),'dispersionBRL':statistics.pstdev(excess),'drawdownPenaltyBRL':.25*dd,'complexityPenaltyBRL':.001*len(columns(genome)),
            'meanMonthlyBRL':statistics.mean(w['pnlBRL'] for w in wallets),'meanCDIBRL':statistics.mean(w['cdi']['pnlBRL'] for w in wallets),'count':trades,'aboveCDI':sum(x>0 for x in excess),'supportSufficient':trades>=30 and sum(w['count']>0 for w in wallets)>=3}
def initial_population(seed):
    import random
    rng=random.Random(seed);out=[]
    for island in range(4):out.extend([{'island':island,'genome':founder() if i==0 else random_genome(rng)} for i in range(64)])
    return out
def evolve(population,results,seed,generation,stagnation):
    import random
    rng=random.Random(seed+generation*7919);out=[];boost=stagnation>=8;rate=.45 if boost else .2;immigrants=20 if boost else 8;ranked=[]
    for island in range(4):
        group=[p for p in population if p['island']==island]
        group.sort(key=lambda p:(-results[identity(p['genome'])]['fitness'],identity(p['genome'])))
        ranked.append(group)
    for island,group in enumerate(ranked):
        genomes=[dict(p['genome']) for p in group[:4]]
        if island==0:genomes[0]=founder()
        while len(genomes)<64-immigrants:
            a,b=rng.sample(group[:16],2);g={k:(a if rng.random()<.5 else b)['genome'][k] for k in founder()};genomes.append(mutate(g,rng,rate))
        genomes.extend(random_genome(rng) for _ in range(immigrants))
        if generation%5==0:
            genomes[-2:]=[dict(p['genome']) for p in ranked[(island-1)%4][:2]]
        out.extend({'island':island,'genome':g} for g in genomes)
    return out,{'mutationRate':rate,'immigrantsPerIsland':immigrants,'migration':generation%5==0,'expanded':boost}
