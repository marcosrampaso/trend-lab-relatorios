"""Finite genetic or PPO entry specialist. PPO is a one-step contextual bandit,
not the old full-position FinRL trading environment. Fixed exits provide rewards.
"""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:
    os.environ[key]='1'
import hashlib,json,sys,time
from pathlib import Path
import numpy as np
import joblib
import gymnasium as gym
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from sklearn.isotonic import IsotonicRegression
from sklearn.preprocessing import StandardScaler

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'work/pepe-specialists-v1'
P=json.loads((BASE/'protocol.json').read_text())
SIDE=int(sys.argv[1]);FAMILY=sys.argv[2];SEED=int(sys.argv[3])
KEY=f'{FAMILY}-{SIDE}-{SEED}'
D=P['featureCount']
OUT=BASE/'models'/KEY;OUT.mkdir(parents=True,exist_ok=True)
torch.set_num_threads(1);torch.set_num_interop_threads(1)
def write(file,value,immutable=False):
    text=json.dumps(value,allow_nan=False,separators=(',',':'))
    if immutable:
        with Path(file).open('x') as f:f.write(text)
        Path(file).chmod(0o444)
    else:
        tmp=Path(str(file)+'.tmp');tmp.write_text(text);tmp.replace(file)
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def status(**extra):write(OUT/'status.json',{'key':KEY,'updatedAt':int(time.time()*1000),**extra})
if SIDE not in [1,-1] or (FAMILY,SEED) not in [('genetic',151),('ppo',101),('ppo',202)]:
    raise ValueError('Unregistered expert')
if (OUT/'complete.json').exists():raise ValueError('Expert already frozen')
registration=json.loads((BASE/'dataset-registration.json').read_text())
for name,h in registration['files'].items():
    if sha(ROOT/name)!=h:raise ValueError('Changed labels')
rows=[]
for m in P['months']:
    if m['split']=='evaluation':continue
    packet=json.loads((BASE/'labels'/f"{m['month']}.json").read_text())
    # End-of-stage embargo applies to maturity, not just the feature timestamp.
    cutoff=P['stageEnds'][m['split']]-P['embargoMinutes']*60000
    for row in packet['rows']:
        if row['side']==SIDE and row['exitAt']<=cutoff:
            rows.append({**row,'split':m['split'],'month':m['month']})
def subset(split):
    r=[r for r in rows if r['split']==split]
    if len(r)<P['minimumRowsPerSide']:raise ValueError('Insufficient chronological stage')
    return np.asarray([r['x'] for r in r],np.float32),np.asarray([r['netR'] for r in r]),np.asarray([r['month'] for r in r])
X,y,months=subset('train');V,vy,vm=subset('selection');C,cy,cm=subset('calibration')
scaler=StandardScaler().fit(X);X=scaler.transform(X).astype(np.float32)
V=scaler.transform(V).astype(np.float32);C=scaler.transform(C).astype(np.float32)
joblib.dump(scaler,OUT/'scaler.joblib')
def fitness(allow,values,groups):
    a=np.asarray([np.mean(values[groups==m]*allow[groups==m]) for m in np.unique(groups)])
    # This is an independent-label opportunity score, never a portfolio PNL/DD.
    return float(a.mean()-.25*a.std())
if FAMILY=='genetic':
    rng=np.random.default_rng(SEED+SIDE);pop=rng.normal(0,.5,(P['genetic']['population'],D+1));pop[:,-1]=rng.uniform(-1,1,len(pop))
    champions=[]
    for generation in range(P['genetic']['generations']):
        scores=X@pop[:,:D].T+pop[:,D]
        fits=np.asarray([fitness(scores[:,i]>0,y,months) for i in range(len(pop))])
        order=np.argsort(-fits,kind='stable');winner=pop[order[0]].copy()
        champions.append(winner)
        write(OUT/f'generation-{generation}.json',{'generation':generation,'fitness':float(fits[order[0]]),'genome':winner.tolist()},True)
        status(phase='evolving',generation=generation+1,totalGenerations=P['genetic']['generations'],fitness=float(fits[order[0]]))
        elites=pop[order[:4]].copy();parents=pop[order[:12]]
        children=[]
        for _ in range(len(pop)-12):
            a,b=parents[rng.integers(0,12,2)];child=np.where(rng.random(D+1)<.5,a,b)
            child=child+rng.normal(0,.2,D+1)*(rng.random(D+1)<.35);children.append(child)
        pop=np.vstack([elites,np.asarray(children),rng.normal(0,.7,(8,D+1))])
    # Only chronological selection months choose among training champions.
    champions.append(np.r_[np.zeros(D),-100.])
    validation=[fitness(V@g[:D]+g[D]>0,vy,vm) for g in champions]
    selected=int(np.argmax(validation));genome=champions[selected]
    write(OUT/'genome.json',{'genome':genome.tolist(),'selectedTrainingChampion':selected,'selectionFitness':validation},True)
    def score(A):return A@genome[:D]+genome[D]
else:
    class Opportunities(gym.Env):
        observation_space=gym.spaces.Box(-np.inf,np.inf,(D,),np.float32)
        action_space=gym.spaces.Discrete(2)
        def reset(self,seed=None,options=None):
            super().reset(seed=seed);self.i=int(self.np_random.integers(len(X)))
            return X[self.i],{}
        def step(self,action):
            reward=.1*float(y[self.i]) if int(action)==1 else 0.
            return X[self.i],reward,True,False,{}
    class Progress(BaseCallback):
        def _on_step(self):
            if self.num_timesteps%4096==0:status(phase='ppo_training',steps=self.num_timesteps,totalSteps=P['ppo']['steps'])
            return True
    model=PPO('MlpPolicy',Opportunities(),seed=SEED,device='cpu',n_steps=256,batch_size=64,n_epochs=5,
        learning_rate=.0003,gamma=0.,ent_coef=.01,policy_kwargs={'net_arch':[32,32]},verbose=0)
    model.learn(total_timesteps=P['ppo']['steps'],callback=Progress());model.save(OUT/'model.zip')
    def score(A):
        with torch.no_grad():
            return np.concatenate([model.policy.get_distribution(torch.as_tensor(a,device='cpu')).distribution.probs[:,1].cpu().numpy()
                for a in np.array_split(A,max(1,int(np.ceil(len(A)/2048))))])

# Fixed March block maps each specialist score to expected net R; no tuning here.
calibrator=IsotonicRegression(out_of_bounds='clip').fit(score(C),cy)
joblib.dump(calibrator,OUT/'calibrator.joblib')
write(OUT/'metrics.json',{'key':KEY,'side':SIDE,'family':FAMILY,'seed':SEED,
    'trainRows':len(X),'selectionRows':len(V),'calibrationRows':len(C),
    'target':'net R after all modeled costs under fixed ladder_lock exit',
    'trainOpportunityMeanR':float(y.mean()),'calibrationOpportunityMeanR':float(cy.mean()),
    'calibrationIsNotIndependentTest':True},True)
predictions=[]
for m in P['months']:
    if m['split']!='evaluation':continue
    packet=json.loads((BASE/'labels'/f"{m['month']}.json").read_text())
    A=np.asarray([r['x'] for r in packet['rows']],np.float32)
    raw=score(scaler.transform(A).astype(np.float32));values=calibrator.predict(raw)
    cutoff=0. if FAMILY=='genetic' else .5
    predictions.extend({'at':r['at'],'netR':float(value),'eligible':bool(s>cutoff)}
        for r,value,s in zip(packet['rows'],values,raw))
write(OUT/'predictions.json',{'key':KEY,'side':SIDE,'predictions':predictions},True)
artifacts={str(f.relative_to(ROOT)):sha(f) for f in OUT.iterdir() if f.is_file() and f.name not in ['status.json','complete.json']}
for f in OUT.iterdir():
    if f.is_file() and f.name!='status.json':f.chmod(0o444)
write(OUT/'complete.json',{'key':KEY,'completedAt':int(time.time()*1000),'artifacts':artifacts},True)
status(phase='complete',trainRows=len(X),calibrationRows=len(C))
