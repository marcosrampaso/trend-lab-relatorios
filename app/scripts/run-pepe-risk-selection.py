"""Finite offline selection/classification/calibration experiment; never touches PPO state."""
import os
for key in ['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS']:
    os.environ[key] = '1'
try:
    os.nice(10)
except OSError:
    pass
import hashlib
import importlib
import json
import sys
import time
import warnings
from pathlib import Path
import numpy as np
import joblib
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import log_loss
import pepe_risk_selection as core

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'work/pepe-risk-selection-v1'
PUBLIC = ROOT / 'web/data/pepe-risk-selection.json'
CONFIG = json.loads((ROOT / 'pepe-risk-selection-protocol.json').read_text())


def read(file):
    return json.loads(Path(file).read_text())


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def atomic(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    tmp = file.with_name(file.name + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False))
    tmp.replace(file)


def immutable_json(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    with file.open('x') as out:
        json.dump(value, out, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    file.chmod(0o444)


def immutable_model(file, model):
    if file.exists():
        raise ValueError('Refuse to overwrite model evidence')
    joblib.dump(model, file)
    file.chmod(0o444)
    return {'path': str(file.relative_to(ROOT)), 'sha256': sha(file)}


def register(selected):
    source_files = ['pepe-risk-selection-protocol.json', 'scripts/run-pepe-risk-selection.py',
                    'scripts/pepe_risk_selection.py', 'scripts/pepe-nb-risk-core.py',
                    'data/pepe-finrl-v1/features/index.json']
    sources = {f: sha(ROOT / f) for f in source_files}
    data = {f: digest for month in selected for f, digest in
            [(month['path'], month['sha256']), (month['rawPath'], month['rawSHA256'])]}
    dependencies = {}
    for name in ['sklearn.calibration', 'sklearn.feature_selection._from_model',
                 'sklearn.linear_model._logistic', 'sklearn.naive_bayes', 'sklearn.pipeline',
                 'sklearn.preprocessing._data', 'sklearn.frozen._frozen']:
        file = Path(importlib.import_module(name).__file__).resolve()
        dependencies[str(file.relative_to(ROOT))] = sha(file)
    registration = {'id': CONFIG['id'], 'registeredAt': int(time.time() * 1000), 'protocol': CONFIG,
                    'sourceHashes': sources, 'dataHashes': data, 'dependencyHashes': dependencies,
                    'versions': {'sklearn': sklearn.__version__, 'numpy': np.__version__, 'joblib': joblib.__version__},
                    'independentFinalTest': False, 'ppoConnected': False, 'realOrders': False}
    file = BASE / 'registration.json'
    if file.exists():
        prior = read(file)
        for key in ['protocol', 'sourceHashes', 'dataHashes', 'dependencyHashes', 'versions']:
            if prior[key] != registration[key]:
                raise ValueError('Registered inputs changed; use a new experiment')
    else:
        immutable_json(file, registration)
    return sha(file)


def fit_model(model, x, y):
    core.require_classes(y)
    with warnings.catch_warnings():
        warnings.simplefilter('error', ConvergenceWarning)
        model.fit(x, y)
    return model


def load_dataset(selected):
    label_core = importlib.import_module('pepe-nb-risk-core')
    x, y, times, sides, ratios = [], [], [], [], []
    counts = {'skippedNonSampling': 0, 'skippedImmature': 0, 'skippedUntradableOpen': 0}
    for month in selected:
        for file, digest in [(month['path'], month['sha256']), (month['rawPath'], month['rawSHA256'])]:
            if sha(ROOT / file) != digest:
                raise ValueError('Changed data ' + file)
        packet = read(ROOT / month['path'])
        candles = read(ROOT / month['rawPath'])['candles']
        for row in packet['features']:
            at = row['at']
            if at % (CONFIG['samplingMinutes'] * 60000):
                counts['skippedNonSampling'] += 1
                continue
            if not label_core.eligible_window(at, packet['start'], packet['end']):
                counts['skippedImmature'] += 1
                continue
            if row['knownAt'] > at or len(row['x']) != 15:
                raise ValueError('Noncausal or incompatible features')
            offset = (at - packet['start']) // 60000
            future = candles[offset:offset + CONFIG['horizonMinutes']]
            if len(future) != 30 or any(r[0] != at + i * 60000 for i, r in enumerate(future)):
                raise ValueError('Noncontiguous label interval')
            if future[0][5] <= 0:
                counts['skippedUntradableOpen'] += 1
                continue
            for side in [1, -1]:
                entry = future[0][1] * (1 + side * CONFIG['entrySlippage'])
                label, ratio = label_core.risk_label(side, entry, row['atr'], future)
                x.append([*row['x'], side]); y.append(label)
                times.append(at); sides.append(side); ratios.append(ratio)
    x = np.asarray(x, dtype=float)
    if not np.isfinite(x).all():
        raise ValueError('Nonfinite classifier input')
    return x, np.asarray(y), np.asarray(times, dtype=np.int64), np.asarray(sides), np.asarray(ratios), counts


def choose_C(family, seed, x, y, times, fold):
    candidates = []
    for C in CONFIG['selection']['CGrid']:
        scores = []
        windows = []
        for validation in fold['inner']:
            train, valid = core.inner_masks(times, fold['fit'][0], validation)
            if times[valid].max() + core.HORIZON_MS > core.stamp(fold['fit'][1]):
                raise ValueError('Inner selection escaped outer training')
            model = fit_model(core.pipeline(family, 'selected', C, seed, CONFIG), x[train], y[train])
            scores.append(float(log_loss(y[valid], model.predict_proba(x[valid]), labels=[0, 1, 2])))
            windows.append({'fitRows': int(train.sum()), 'validationRows': int(valid.sum()),
                            'lastFitLabelAt': int(times[train].max() + core.HORIZON_MS),
                            'firstValidationAt': int(times[valid].min()), 'period': validation})
        candidates.append({'C': C, 'meanLogLoss': float(np.mean(scores)), 'innerLogLoss': scores, 'windows': windows})
    chosen = min(candidates, key=lambda row: row['meanLogLoss'])
    return chosen['C'], candidates


def model_id(family, mode, calibration):
    return family + '_' + mode + '_' + calibration


def baselines(xfit, yfit, xeval):
    prior = (np.bincount(yfit, minlength=3) + 1) / (len(yfit) + 3)
    cuts = np.quantile(xfit[:, 1], [1 / 3, 2 / 3])
    buckets = np.searchsorted(cuts, xfit[:, 1])
    probabilities = np.array([(np.bincount(yfit[buckets == i], minlength=3) + 1) /
                              (np.sum(buckets == i) + 3) for i in range(3)])
    return {'prior': np.tile(prior, (len(xeval), 1)),
            'volatility': probabilities[np.searchsorted(cuts, xeval[:, 1])]}


def summarize(report, predictions, truth_by_fold, times_by_fold):
    ids = list(next(iter(predictions.values())).values())[0].keys()
    aggregates = []
    for mid in ids:
        probs, labels, times = [], [], []
        for fold in CONFIG['folds']:
            for seed in CONFIG['seeds']:
                probs.append(predictions[fold['id']][seed][mid])
                labels.append(truth_by_fold[fold['id']]); times.append(times_by_fold[fold['id']])
        aggregates.append({'id': mid, **core.metrics(np.concatenate(labels), np.concatenate(probs)),
                           'evaluations': len(CONFIG['folds']) * len(CONFIG['seeds'])})
    report['aggregate'] = sorted(aggregates, key=lambda r: r['logLoss'])
    effects = []
    for family in CONFIG['families']:
        comparisons = [(family + '_selection_raw', model_id(family, 'all', 'raw'), model_id(family, 'selected', 'raw')),
                       (family + '_selection_sigmoid', model_id(family, 'all', 'sigmoid'), model_id(family, 'selected', 'sigmoid')),
                       (family + '_calibration_all', model_id(family, 'all', 'raw'), model_id(family, 'all', 'sigmoid')),
                       (family + '_calibration_selected', model_id(family, 'selected', 'raw'), model_id(family, 'selected', 'sigmoid'))]
        for name, reference, candidate in comparisons:
            deltas, timestamps, fold_results = [], [], []
            for fold in CONFIG['folds']:
                fid = fold['id']; truth = truth_by_fold[fid]
                delta = np.mean([core.brier_losses(truth, predictions[fid][seed][candidate]) -
                                 core.brier_losses(truth, predictions[fid][seed][reference]) for seed in CONFIG['seeds']], axis=0)
                deltas.append(delta); timestamps.append(times_by_fold[fid])
                fold_results.append({'fold': fid, 'deltaBrier': float(delta.mean())})
            effects.append({'id': name, 'reference': reference, 'candidate': candidate,
                            **core.paired_daily_bootstrap(np.concatenate(timestamps), np.concatenate(deltas),
                                                         CONFIG['bootstrap']['repetitions'], CONFIG['bootstrap']['seed']),
                            'folds': fold_results, 'foldsImproved': sum(r['deltaBrier'] < 0 for r in fold_results)})
    report['effects'] = effects
    report['selectionStability'] = []
    for family in CONFIG['families']:
        selected = [row for row in report['featureSelections'] if row['family'] == family]
        report['selectionStability'].append({'family': family, 'fits': len(selected), 'features':
            [{'name': name, 'protected': i in CONFIG['protectedIndices'],
              'selectedFits': sum(name in row['selectedFeatures'] for row in selected)}
             for i, name in enumerate(CONFIG['features'])]})
    selection = [e for e in effects if e['id'].endswith('selection_sigmoid')]
    consistent = [e['id'].split('_')[0] for e in selection if e['upper95'] < 0 and e['foldsImproved'] == len(CONFIG['folds'])]
    report['conclusion'] = ('A seleção com calibração reduziu o Brier nas três janelas e no intervalo descritivo para: ' + ', '.join(consistent) + '.'
                            if consistent else 'A seleção com calibração não demonstrou redução consistente do Brier nas três janelas pelo critério registrado.')
    report['conclusion'] += ' O menor log loss observado foi ' + report['aggregate'][0]['id'] + '. Resultado retrospectivo de classificação; não comprova lucro e não promove um filtro ao PPO.'


def main():
    os.chdir(ROOT)
    BASE.mkdir(parents=True, exist_ok=True)
    if (BASE / 'result.json').exists():
        raise ValueError('Experiment already complete; preserve original results')
    index = read(ROOT / 'data/pepe-finrl-v1/features/index.json')
    selected = [m for m in index['months'] if '2023-06' <= m['month'] < '2025-07' and m['month'] not in CONFIG['excludedMonths']]
    registration_hash = register(selected)
    started = time.monotonic()
    report = {'app': 'trend-lab-risk-selection', 'status': 'preparing', 'protocol': CONFIG,
              'registrationSHA256': registration_hash, 'results': [], 'featureSelections': [],
              'dataset': {}, 'jobsCompleted': 0, 'totalJobs': len(CONFIG['folds']) * len(CONFIG['seeds']) * 4,
              'realOrders': False, 'ppoConnected': False, 'independentFinalTest': False}
    def publish():
        report.update(updatedAt=int(time.time() * 1000), seconds=time.monotonic() - started)
        atomic(PUBLIC, report); atomic(BASE / 'status.json', report)
    publish()
    try:
        x, y, times, sides, ratios, skipped = load_dataset(selected)
        report['dataset'] = {'uniqueCandidateCases': len(y), 'monthsRead': len(selected), 'skippedWindows': skipped,
                             'firstAt': int(times.min()), 'lastAt': int(times.max()), 'folds': []}
        predictions, truth_by_fold, times_by_fold = {}, {}, {}
        for fold in CONFIG['folds']:
            fid = fold['id']
            masks = {part: core.split_mask(times, fold[part]) for part in ['fit', 'calibration', 'evaluation']}
            if any(np.any(masks[a] & masks[b]) for a, b in [('fit', 'calibration'), ('fit', 'evaluation'), ('calibration', 'evaluation')]):
                raise ValueError('Temporal leakage between stages')
            for mask in masks.values():
                core.require_classes(y[mask])
            report['dataset']['folds'].append({'id': fid, 'periods': fold, 'parts':
                {part: {'rows': int(mask.sum()), 'classCounts': np.bincount(y[mask], minlength=3).tolist(),
                        'firstAt': int(times[mask].min()), 'lastAt': int(times[mask].max()),
                        'lastLabelAt': int(times[mask].max() + core.HORIZON_MS)} for part, mask in masks.items()}})
            fit, cal, evaluation = (masks[k] for k in ['fit', 'calibration', 'evaluation'])
            truth_by_fold[fid] = y[evaluation]; times_by_fold[fid] = times[evaluation]
            predictions[fid] = {}
            for seed in CONFIG['seeds']:
                report.update(status='training', currentFold=fid, currentSeed=seed)
                predictions[fid][seed] = {}
                tuning = {}
                for family in CONFIG['families']:
                    for mode in CONFIG['selectionModes']:
                        report.update(currentFamily=family, currentSelection=mode); publish()
                        C, cv = (choose_C(family, seed, x[fit], y[fit], times[fit], fold) if mode == 'selected' else (None, []))
                        model = fit_model(core.pipeline(family, mode, C or 1, seed, CONFIG), x[fit], y[fit])
                        selected_indices = (np.flatnonzero(model.named_steps['select'].get_support()).tolist()
                                            if mode == 'selected' else list(range(len(CONFIG['features']))))
                        feature_names = [CONFIG['features'][i] for i in selected_indices]
                        if mode == 'selected':
                            selection = {'fold': fid, 'seed': seed, 'family': family, 'C': C, 'innerCV': cv,
                                         'selectedFeatures': feature_names, 'selectedIndices': selected_indices}
                            report['featureSelections'].append(selection)
                        raw_file = BASE / f'{fid}-s{seed}-{family}-{mode}-raw.joblib'
                        raw_artifact = immutable_model(raw_file, model)
                        # Freeze the full preprocessing + selector + estimator: calibration cannot refit it.
                        frozen_digest = sha(raw_file)
                        calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid').fit(x[cal], y[cal])
                        if sha(raw_file) != frozen_digest:
                            raise ValueError('Calibration changed base model artifact')
                        cal_artifact = immutable_model(BASE / f'{fid}-s{seed}-{family}-{mode}-sigmoid.joblib', calibrated)
                        for method, predictor, artifact in [('raw', model, raw_artifact), ('sigmoid', calibrated, cal_artifact)]:
                            mid = model_id(family, mode, method)
                            probs = predictor.predict_proba(x[evaluation])
                            predictions[fid][seed][mid] = probs
                            report['results'].append({'id': mid, 'fold': fid, 'seed': seed, 'family': family,
                                'selection': mode, 'calibration': method, 'selectedFeatures': feature_names,
                                'selectionC': C, 'artifact': artifact, **core.metrics(y[evaluation], probs, times[evaluation])})
                        report['jobsCompleted'] += 1; publish()
                for mid, probs in baselines(x[fit], y[fit], x[evaluation]).items():
                    predictions[fid][seed][mid] = probs
                    report['results'].append({'id': mid, 'fold': fid, 'seed': seed, 'family': 'baseline',
                                             'selection': 'all', 'calibration': 'raw', **core.metrics(y[evaluation], probs, times[evaluation])})
                file = BASE / f'{fid}-s{seed}-predictions.npz'
                if file.exists():
                    raise ValueError('Refuse to overwrite predictions')
                np.savez_compressed(file, at=times[evaluation], truth=y[evaluation], side=sides[evaluation],
                                    adverseExcursionR=ratios[evaluation], **predictions[fid][seed])
                file.chmod(0o444)
        report['status'] = 'evaluating'; publish()
        summarize(report, predictions, truth_by_fold, times_by_fold)
        report['uniqueEvaluationCases'] = sum(len(v) for v in truth_by_fold.values())
        report['status'] = 'complete'; publish()
        immutable_json(BASE / 'result.json', report)
        immutable_json(BASE / 'artifact-manifest.json', {'files': {str(p.relative_to(ROOT)): sha(p)
            for p in BASE.iterdir() if p.suffix in ['.joblib', '.npz']}, 'registrationSHA256': registration_hash})
        print(json.dumps({'status': report['status'], 'jobs': report['jobsCompleted'],
                          'uniqueEvaluationCases': report['uniqueEvaluationCases'], 'conclusion': report['conclusion']}, ensure_ascii=False))
    except Exception as error:
        report.update(status='error', error=str(error)); publish(); raise


if __name__ == '__main__':
    main()
