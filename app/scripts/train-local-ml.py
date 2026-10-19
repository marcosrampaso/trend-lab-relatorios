"""Bounded, resumable CPU benchmark. No network, orders or modifications of old studies."""
import argparse, concurrent.futures as futures, hashlib, json, multiprocessing as mp
import os, platform, resource, signal, subprocess, sys, time, warnings
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
STOP=False
def now(): return datetime.now(timezone.utc).isoformat()
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p): return json.loads(Path(p).read_text())
def atomic(p,data):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(data,separators=(',',':'),allow_nan=False));tmp.replace(p)
def month_at(month,offset=0):
    y,m=map(int,month[:7].split('-'));n=y*12+m-1+offset
    return int(datetime(n//12,n%12+1,1,tzinfo=timezone.utc).timestamp()*1000)
def temporal(rows,start,end): return [s for s in rows if start<=s['at']<end and s['labelAvailableAt']<end]
def interrupted(signum,frame):
    global STOP;STOP=True

def estimator(config,seed):
    from sklearn.dummy import DummyClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.tree import DecisionTreeClassifier
    from sklearn.ensemble import RandomForestClassifier,ExtraTreesClassifier,HistGradientBoostingClassifier
    from sklearn.neural_network import MLPClassifier
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    a=config['algorithm'];p=dict(config['params'])
    if a=='constant': return DummyClassifier(strategy='prior')
    if a=='logistic': return make_pipeline(StandardScaler(),LogisticRegression(**p,max_iter=1500,random_state=seed))
    if a=='tree': return DecisionTreeClassifier(**p,random_state=seed)
    if a=='random_forest': return RandomForestClassifier(**p,n_jobs=1,random_state=seed)
    if a=='extra_trees': return ExtraTreesClassifier(**p,n_jobs=1,random_state=seed)
    if a=='hist_boosting': return HistGradientBoostingClassifier(**p,learning_rate=.05,early_stopping=False,random_state=seed)
    if a=='mlp':
        p['hidden_layer_sizes']=tuple(p['hidden_layer_sizes'])
        return make_pipeline(StandardScaler(),MLPClassifier(**p,early_stopping=False,shuffle=False,random_state=seed))
    raise ValueError('Algoritmo desconhecido')

def fit_job(task,inputs_path,run_path):
    import numpy as np,joblib
    from threadpoolctl import threadpool_limits,threadpool_info
    from sklearn.metrics import brier_score_loss,balanced_accuracy_score
    started=time.monotonic();started_wall=now();cpu_start=resource.getrusage(resource.RUSAGE_SELF);inputs=read(inputs_path);p=inputs['protocol']
    family,fold,config=task['family'],task['fold'],task['config']
    train_end=month_at(fold,-3);validation_end=month_at(fold);test_end=month_at(fold,3)
    train=temporal(inputs['groups'][family],month_at(fold,-12),train_end)
    if len(train)<300 or len({s['y'] for s in train})<2: raise ValueError('Treino insuficiente ou sem duas classes')
    val_labels=temporal(inputs['groups'][family],train_end,validation_end)
    features=inputs['features'][family]
    val=[s for s in features if train_end<=s['at']<validation_end]
    test=[s for s in features if validation_end<=s['at']<test_end]
    model=estimator(config,task['seed'])
    with threadpool_limits(limits=1),warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        model.fit(np.asarray([s['x'] for s in train]),np.asarray([s['y'] for s in train]))
        def scores(a):
            values=model.predict_proba(np.asarray([s['x'] for s in a]))[:,list(model.classes_).index(1)]
            if not np.isfinite(values).all(): raise ValueError('Score inválido')
            return [[s['at'],float(v)] for s,v in zip(a,values)]
        validation=scores(val);testing=scores(test)
        known=dict(validation);truth=[s['y'] for s in val_labels];pred=[known[s['at']] for s in val_labels]
        metrics={'brier':float(brier_score_loss(truth,pred)),'balancedAccuracy':float(balanced_accuracy_score(truth,[v>=.5 for v in pred]))}
        pools=[{'internal_api':v['internal_api'],'num_threads':v['num_threads']} for v in threadpool_info()]
    target=Path(run_path)/'models'/(task['id']+'.joblib');target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix('.tmp');joblib.dump(model,tmp,compress=3);tmp.replace(target)
    result={**task,'startedAt':started_wall,'trainCount':len(train),'trainPositive':sum(s['y'] for s in train),'maxTrainLabelAvailableAt':max(s['labelAvailableAt'] for s in train),
        'trainStart':month_at(fold,-12),'trainEnd':train_end,'validationEnd':validation_end,'testEnd':test_end,
        'validation':validation,'test':testing,'validationMetrics':metrics,'warnings':sorted(set(str(w.message) for w in caught)),
        'seconds':time.monotonic()-started,'cpuSeconds':resource.getrusage(resource.RUSAGE_SELF).ru_utime+resource.getrusage(resource.RUSAGE_SELF).ru_stime-cpu_start.ru_utime-cpu_start.ru_stime,
        'workerPID':os.getpid(),'threadPools':pools,'maxWorkerRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024),
        'artifact':str(target.relative_to(ROOT)),'artifactSHA256':sha(target)}
    atomic(Path(run_path)/'predictions'/(task['id']+'.json'),result)
    return {k:result[k] for k in ['id','family','fold','config','trainCount','seconds','workerPID','maxWorkerRSSBytes','warnings']}

def main():
    import sklearn,numpy,scipy,joblib
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--workers',type=int,default=os.cpu_count() or 1)
    ap.add_argument('--max-minutes',type=float,default=None)
    ap.add_argument('--profile',choices=['quick','balanced','overnight'],default='balanced')
    ap.add_argument('--run-id',default=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    ap.add_argument('--quick',action='store_true');ap.add_argument('--resume',action='store_true')
    args=ap.parse_args()
    if not all(c.isalnum() or c in '-_' for c in args.run_id): ap.error('run-id inválido')
    if (args.max_minutes is not None and args.max_minutes<=0) or args.workers<1: ap.error('Recursos precisam ser positivos')
    workers=min(args.workers,os.cpu_count() or args.workers,10)
    p=read(ROOT/'local-ml-protocol.json');profile='quick' if args.quick else args.profile;quick=profile=='quick';max_minutes=args.max_minutes or p['profiles'][profile]['maxMinutes'];run=ROOT/'work/local-ml/runs'/args.run_id;run.mkdir(parents=True,exist_ok=True)
    fingerprint={'protocol':sha(ROOT/'local-ml-protocol.json'),'samples':sha(ROOT/'data/scalp-tree/samples.json'),'features':sha(ROOT/'data/scalp-tree/features.json'),
       'trainer':sha(__file__),'evaluator':sha(ROOT/'scripts/evaluate-local-ml.mjs'),'evaluationHelpers':sha(ROOT/'scripts/local-ml-evaluation.mjs'),'engine':sha(ROOT/'web/scalp-tree-engine.js'),'quick':quick,'profile':profile,
       'python':platform.python_version(),'sklearn':sklearn.__version__,'numpy':numpy.__version__,'scipy':scipy.__version__,'joblib':joblib.__version__}
    record=run/'registration.json'
    if record.exists():
        if read(record)['fingerprint']!=fingerprint: raise ValueError('Checkpoint incompatível com dados, código ou bibliotecas atuais')
        if not args.resume: raise ValueError('Run existente: use --resume')
    else: atomic(record,{'createdAt':now(),'fingerprint':fingerprint,'protocol':p})
    groups=read(ROOT/'data/scalp-tree/samples.json')['groups'];features=read(ROOT/'data/scalp-tree/features.json')['features']
    inputs=run/'inputs.json'
    if not inputs.exists(): atomic(inputs,{'protocol':p,'groups':groups,'features':features})
    configs=p['configs'] if not quick else [c for c in p['configs'] if c['id'] in ['logistic-c1','rf-d5','boost-7']]
    folds=p['folds'] if not quick else p['folds'][:1]
    tasks=[]
    for family in p['families']:
        for fold in folds:
            for c in configs:
                seeds=p['profiles'][profile]['seeds'] if c['algorithm'] in p['profiles'][profile].get('repeatAlgorithms',[]) else [p['seed']]
                for seed in seeds: tasks.append({'id':f'{family}-{fold}-{c["id"]}-s{seed}','family':family,'fold':fold,'config':c,'seed':seed})
    pending=[];done=[];errors=[]
    for task in tasks:
        output=run/'predictions'/(task['id']+'.json')
        if output.exists():
            saved=read(output)
            if saved['id']!=task['id'] or saved['config']!=task['config'] or sha(ROOT/saved['artifact'])!=saved['artifactSHA256']: raise ValueError('Checkpoint corrompido')
            done.append({'id':task['id'],'seconds':saved['seconds'],'resumed':True})
        else: pending.append(task)
    started=time.monotonic();deadline=started+max_minutes*60
    status={'runId':args.run_id,'pid':os.getpid(),'startedAt':now(),'state':'training','workers':workers,'threadsPerWorker':1,'total':len(tasks),'completed':len(done),'failed':0,'quick':quick,'profile':profile,'deadlineAt':datetime.fromtimestamp(time.time()+max_minutes*60,timezone.utc).isoformat(),'hardware':{'architecture':platform.machine(),'cpuCount':os.cpu_count()},'fingerprint':fingerprint}
    def publish(**extra):
        status.update(extra);status['updatedAt']=now();status['elapsedSeconds']=time.monotonic()-started
        atomic(run/'status.json',status);atomic(ROOT/'web/data/cpu-training-status.json',status)
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
    publish();print(json.dumps(status),flush=True)
    executor=futures.ProcessPoolExecutor(max_workers=workers,mp_context=mp.get_context('spawn'))
    active={};iterator=iter(pending)
    def queue():
        while len(active)<workers:
            task=next(iterator,None)
            if task is None: break
            active[executor.submit(fit_job,task,str(inputs),str(run))]=task
    try:
        queue()
        while active and not STOP and time.monotonic()<deadline:
            finished,_=futures.wait(active,timeout=1,return_when=futures.FIRST_COMPLETED)
            for future in finished:
                task=active.pop(future)
                try: item=future.result();done.append(item);print(json.dumps({'done':item['id'],'seconds':round(item['seconds'],2),'completed':len(done),'total':len(tasks)}),flush=True)
                except Exception as e: errors.append({'id':task['id'],'error':str(e)})
                publish(completed=len(done),failed=len(errors),lastCompleted=task['id'])
            queue()
    finally:
        executor.shutdown(wait=False,cancel_futures=True)
        for child in mp.active_children(): child.terminate()
    atomic(run/'tasks.json',{'tasks':tasks,'done':done,'errors':errors})
    if STOP or time.monotonic()>=deadline:
        publish(state='stopped' if STOP else 'time_limit',reason='Checkpoints preservados.');return
    if errors:
        publish(state='failed',errors=errors);raise RuntimeError('Tarefas falharam; consulte status.json')
    publish(state='evaluating')
    log=open(run/'evaluation.log','a')
    child=subprocess.Popen(['node',str(ROOT/'scripts/evaluate-local-ml.mjs'),str(run)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
    while child.poll() is None and not STOP and time.monotonic()<deadline: time.sleep(.5)
    if child.poll() is None:
        child.terminate()
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired: child.kill();child.wait()
        log.close();publish(state='stopped' if STOP else 'time_limit',reason='Treino salvo; avaliação interrompida.');return
    log.close()
    if child.returncode: publish(state='failed',reason='Falha na avaliação financeira; consulte evaluation.log');raise RuntimeError('Avaliação falhou')
    publish(state='completed',finishedAt=now(),artifactDirectory=str(run.relative_to(ROOT)))
    print(json.dumps(status),flush=True)

if __name__=='__main__':
    for var in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']: os.environ[var]='1'
    main()
