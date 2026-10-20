"""Finite offline entry classifier study. No PPO learning, filtering or financial A/B."""
import os
for key in ['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS']:
    os.environ[key] = '1'
try:
    os.nice(10)
except OSError:
    pass
import hashlib
import importlib
import itertools
import json
import time
import warnings
from pathlib import Path
import numpy as np
import joblib
import sklearn
import torch
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import log_loss
from sb3_contrib import MaskablePPO
from pepe_mask_env import PepeMaskedEnv
import pepe_entry_risk as core

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'work/pepe-entry-risk-v1'
PUBLIC = ROOT / 'web/data/pepe-entry-risk.json'
P = json.loads((ROOT / 'pepe-entry-risk-protocol.json').read_text())
torch.set_num_threads(1)
torch.set_num_interop_threads(1)


def read(p):
    return json.loads(Path(p).read_text())


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def write(p, value, immutable=False):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    if immutable:
        with p.open('x') as f:
            f.write(text)
        p.chmod(0o444)
    else:
        t = p.with_name(p.name + '.tmp')
        t.write_text(text)
        t.replace(p)


def register():
    original = read(ROOT / 'work/pepe-finrl-mask-v3/registration.json')
    source = dict(original['sourceHashes'])
    source.update({p: sha(ROOT / p) for p in ['pepe-entry-risk-protocol.json',
        'scripts/run-pepe-entry-risk.py', 'scripts/pepe_entry_risk.py', 'scripts/pepe_risk_selection.py']})
    # Verify every inherited execution source instead of substituting its current hash.
    for path, digest in source.items():
        if sha(ROOT / path) != digest:
            raise ValueError('Execution source changed: ' + path)
    index = read(ROOT / 'data/pepe-finrl-v1/features/index.json')
    data = {}
    for month in index['months']:
        if P['replay']['start'] <= month['month'] < P['replay']['end']:
            for path, digest in [(month['path'], month['sha256']), (month['rawPath'], month['rawSHA256'])]:
                if sha(ROOT / path) != digest:
                    raise ValueError('Market data hash mismatch')
                data[path] = digest
    if len(data) != 12:
        raise ValueError('Expected exactly six feature and six market packets')
    models = {}
    for policy in P['frozenPolicies']:
        for path, digest in [(policy['path'], policy['sha256']), (policy['metadataPath'], policy['metadataSHA256'])]:
            if sha(ROOT / path) != digest:
                raise ValueError('Immutable policy changed')
            models[path] = digest
    dependencies = dict(original['dependencyHashes'])
    for name in ['sklearn.calibration', 'sklearn.frozen._frozen', 'sklearn.linear_model._logistic',
                 'sklearn.ensemble._hist_gradient_boosting.gradient_boosting', 'sklearn.preprocessing._data']:
        path = Path(importlib.import_module(name).__file__).resolve()
        dependencies[str(path.relative_to(ROOT))] = sha(path)
    for path, digest in dependencies.items():
        if sha(ROOT / path) != digest:
            raise ValueError('Dependency changed: ' + path)
    registration = {'id': P['id'], 'registeredAt': int(time.time()*1000), 'protocol': P,
                    'sourceHashes': source, 'dataHashes': data, 'policyHashes': models,
                    'dependencyHashes': dependencies, 'versions': {'sklearn': sklearn.__version__,
                    'numpy': np.__version__, 'torch': torch.__version__}, 'ppoConnected': False,
                    'realOrders': False, 'independentFinalTest': False}
    write(BASE / 'registration.json', registration, True)
    return sha(BASE / 'registration.json')


def collect_policy(policy):
    env = PepeMaskedEnv('validation', 'stress')
    attempts = {}
    try:
        model = MaskablePPO.load(ROOT / policy['path'], device='cpu')
        obs, info = env.reset(seed=P['seed'])
        at = info['at']
        done = False
        while not done:
            masks = env.action_masks()
            action, _ = model.predict(obs, action_masks=masks, deterministic=True)
            action = int(action)
            if not masks[action]:
                raise ValueError('Invalid masked action')
            if action in [1, 2, 8, 9]:
                attempts[at] = {'decisionAt': at, 'action': action, 'side': 1 if action in [1, 8] else -1,
                                'x': [*map(float, obs[:15]), 1 if action in [1, 8] else -1]}
            obs, _, done, _, info = env.step(action)
            at = info['at']
        summary = env.last_summary
        cases = []
        for trade in summary['trades']:
            attempt = attempts.get(trade['signalAt'])
            if attempt is None or attempt['decisionAt'] != trade['entryAt'] or attempt['side'] != trade['side']:
                raise ValueError('Filled position lacks its causal PPO proposal')
            cases.append({**attempt, 'entryAt': trade['entryAt'], 'entry': trade['entry'],
                          'initialStop': trade['initialStop'], 'strategyTarget': trade['strategyTarget'],
                          'leverage': trade['leverage'], 'actualExitAt': trade['exitAt'],
                          'actualExitReason': trade['reason'], 'policyIDs': [policy['id']]})
        # Full private baseline ledger proves proposal/fill alignment; never an A/B result.
        write(BASE / ('replay-' + policy['id'] + '.json'), {'policy': policy, 'attempts': list(attempts.values()),
              'baselineLedger': summary, 'financialComparison': False}, True)
        return cases, {'policy': policy['id'], 'attempts': len(attempts), 'fills': len(cases),
                       'unfilledProposals': len(attempts)-len(cases), 'halted': summary['halted'],
                       'haltAt': summary['haltAt'], 'continuousWallet': True}
    finally:
        env.close()


def labels(cases):
    candles = []
    for month in ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06']:
        candles.extend(read(ROOT / ('data/pepe-finrl-v1/' + month + '.json'))['candles'])
    start, end = core.stamp('2025-01'), core.stamp('2025-07')
    if len(candles) != (end-start)//core.MINUTE:
        raise ValueError('Incomplete six-month calendar')
    output = []
    for case in sorted(cases, key=lambda r:(r['decisionAt'], r['side'])):
        stage = core.stage_at(case['decisionAt'], P['stages'])
        offset = (case['entryAt']-start)//core.MINUTE
        result = core.reference_label(case, itertools.islice(candles, offset, None), core.stamp(stage['end']))
        output.append({**case, **result, 'stage': stage['id']})
    return output


def fit(model, x, y):
    with warnings.catch_warnings():
        warnings.simplefilter('error', ConvergenceWarning)
        model.fit(x, y)
    return model


def tuning(family, mode, rows, x, y):
    folds = []
    for period in P['inner']:
        train, valid = core.chronological_masks(rows, **period)
        usable = bool(train.any() and valid.any() and min(np.bincount(y[train], minlength=2)) >= 2
                      and min(np.bincount(y[valid], minlength=2)) >= 1)
        folds.append({'period': period, 'fitRows': int(train.sum()), 'validRows': int(valid.sum()), 'usable': usable,
                      'train': train, 'valid': valid})
    usable = [f for f in folds if f['usable']]
    grid = []
    for selector_c in P['selectorCGrid'] if mode == 'selected' else [P['fallback']['selectorC']]:
        for parameter in P['classifierGrid'][family]:
            losses = []
            for f in usable:
                model = fit(core.make_pipeline(family, mode, selector_c, parameter, P), x[f['train']], y[f['train']])
                losses.append(float(log_loss(y[f['valid']], model.predict_proba(x[f['valid']]), labels=[0,1])))
            grid.append({'selectorC': selector_c, 'parameter': parameter, 'innerLosses': losses,
                         'meanLogLoss': float(np.mean(losses)) if losses else None})
    if usable:
        chosen = min(grid, key=lambda r:r['meanLogLoss'])
    else:
        chosen = {'selectorC': P['fallback']['selectorC'], 'parameter': P['fallback'][family], 'innerLosses': [], 'meanLogLoss': None}
    return {**chosen, 'fixedFallback': not bool(usable), 'grid': grid,
            'folds': [{k:v for k,v in f.items() if k not in ['train','valid']} for f in folds]}


def models(parts, report, artifacts):
    counts = {stage: np.bincount([r['y'] for r in rows], minlength=2) for stage, rows in parts.items()}
    if min(counts['fit']) < 2 or min(counts['calibration']) < 2 or len(parts['evaluation']) == 0:
        report['modelStatus'] = 'blocked_missing_class_or_examples'
        report['conclusion'] = 'A coleta terminou, mas faltam exemplos/classes para ajustar e calibrar sem fabricar dados.'
        return
    matrices = {k:np.array([r['x'] for r in v], dtype=float) for k,v in parts.items()}
    truth = {k:np.array([r['y'] for r in v], dtype=int) for k,v in parts.items()}
    probabilities = {}
    prior = (truth['fit'].sum()+1)/(len(truth['fit'])+2)
    probabilities['prior'] = np.full(len(truth['evaluation']), prior)
    report['tuning'] = []
    for family in P['families']:
        for mode in P['featureModes']:
            selected = tuning(family, mode, parts['fit'], matrices['fit'], truth['fit'])
            model = fit(core.make_pipeline(family, mode, selected['selectorC'], selected['parameter'], P), matrices['fit'], truth['fit'])
            features = list(np.flatnonzero(model.named_steps['select'].get_support())) if mode=='selected' else list(range(16))
            before = joblib.hash(model)
            calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid')
            calibrated.fit(matrices['calibration'], truth['calibration'])
            if joblib.hash(model) != before:
                raise ValueError('Calibration refitted a base pipeline')
            for method, estimator in [('raw',model),('sigmoid',calibrated)]:
                mid = family+'_'+mode+'_'+method
                path = BASE/(mid+'.joblib')
                if path.exists():
                    raise ValueError('Refuse model overwrite')
                joblib.dump(estimator,path);path.chmod(0o444)
                artifacts[str(path.relative_to(ROOT))]=sha(path)
                probabilities[mid]=estimator.predict_proba(matrices['evaluation'])[:,1]
            report['tuning'].append({'family':family,'mode':mode,'selectedFeatures':[P['features'][i] for i in features], **selected})
    prediction_path=BASE/'evaluation-predictions.npz'
    with prediction_path.open('xb') as f:
        np.savez_compressed(f,y=truth['evaluation'],times=np.array([r['decisionAt'] for r in parts['evaluation']],dtype=np.int64),**probabilities)
    prediction_path.chmod(0o444);artifacts[str(prediction_path.relative_to(ROOT))]=sha(prediction_path)
    report['results']=sorted([{'id':mid,**core.binary_metrics(truth['evaluation'],prob)} for mid,prob in probabilities.items()],key=lambda r:r['logLoss'])
    report['modelStatus']='descriptive_complete'
    report['conclusion']='Comparação descritiva concluída. '+('O piso de amostra foi atendido, mas não equivale a poder estatístico ou aprovação.' if report['sampleGate']['passed'] else 'Amostra abaixo do piso registrado: nenhum classificador está aprovado para apoiar decisões.')


def main():
    os.chdir(ROOT)
    if (BASE/'registration.json').exists():
        raise ValueError('Write-once experiment already registered; preserve evidence')
    started=time.monotonic();BASE.mkdir(parents=True,exist_ok=True)
    registration=register()
    report={'app':'trend-lab','id':P['id'],'status':'collecting','protocol':P,'registrationSHA256':registration,
            'policiesCompleted':0,'policyCount':len(P['frozenPolicies']),'replays':[],'results':[],
            'ppoConnected':False,'realOrders':False,'independentFinalTest':False,'financialComparisonStarted':False}
    write(PUBLIC,report)
    all_cases=[];artifacts={}
    for policy in P['frozenPolicies']:
        cases,stats=collect_policy(policy);all_cases.extend(cases);report['replays'].append(stats)
        report['policiesCompleted']+=1;report['seconds']=time.monotonic()-started;write(PUBLIC,report)
    unique={}
    for case in all_cases:
        key=tuple(case[k] for k in ['decisionAt','side','entry','initialStop','strategyTarget'])
        if key not in unique:unique[key]=case
        else:
            if unique[key]['x']!=case['x']:raise ValueError('Conflicting causal features for duplicate entry')
            unique[key]['policyIDs'].extend(case['policyIDs'])
    cases=labels(list(unique.values()))
    write(BASE/'entry-cases.json',cases,True)
    parts={s['id']:[r for r in cases if r['stage']==s['id'] and r['status']=='resolved'] for s in P['stages']}
    report.update(status='fitting',rawFills=len(all_cases),uniqueEntries=len(cases),duplicateFillsRemoved=len(all_cases)-len(cases),
                  stages=[{**s,'total':sum(r['stage']==s['id'] for r in cases),'resolved':len(parts[s['id']]),
                           'classCounts':np.bincount([r['y'] for r in parts[s['id']]],minlength=2).tolist(),
                           'ambiguous':sum(r['stage']==s['id'] and r['status']=='ambiguous' for r in cases),
                           'censored':sum(r['stage']==s['id'] and r['status']=='censored' for r in cases)} for s in P['stages']],
                  sampleGate=core.sample_gate(parts,P['sampleRequirements']))
    write(PUBLIC,report)
    models(parts,report,artifacts)
    report['step4']=core.step4_gate(read(ROOT/'web/data/pepe-mask.json'),read(ROOT/'work/pepe-finrl-mask-v3/checkpoint.json'))
    report.update(status='complete',seconds=time.monotonic()-started,updatedAt=int(time.time()*1000))
    for file in BASE.glob('*.json'):
        artifacts[str(file.relative_to(ROOT))]=sha(file)
    write(BASE/'artifact-manifest.json',{'files':artifacts,'registrationSHA256':registration},True)
    write(BASE/'result.json',report,True);write(PUBLIC,report)
    print(json.dumps({'status':report['status'],'uniqueEntries':report['uniqueEntries'],'stages':report['stages'],'models':len(report['results']),'seconds':report['seconds']}),flush=True)


if __name__=='__main__':
    try:
        main()
    except Exception as e:
        if PUBLIC.exists():
            state=read(PUBLIC)
            if state.get('status')!='complete':state.update(status='error',error=str(e));write(PUBLIC,state)
        raise
