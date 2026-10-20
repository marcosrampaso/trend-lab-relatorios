"""Entry-only, retrospective barrier labels and chronological binary risk models."""
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (log_loss, brier_score_loss, balanced_accuracy_score,
                             confusion_matrix, roc_auc_score, average_precision_score)
from pepe_risk_selection import ProtectedL1Selector, stamp

MINUTE = 60000


def reference_label(trade, candles, stage_end):
    """Initial stop versus nominal 2R reference, NOT PPO realized profit or exit.

    Both touched in one OHLC minute => unknown ordering, excluded. An opening
    gap determines ordering before the high/low. No imposed holding deadline;
    unresolved paths are right-censored at the predeclared stage boundary.
    """
    side, stop, target = trade['side'], trade['initialStop'], trade['strategyTarget']
    entry_at = trade['entryAt']
    if side not in [-1, 1] or (trade['entry'] - stop) * side <= 0 or (target - trade['entry']) * side <= 0:
        raise ValueError('Invalid initial reference bracket')
    expected = entry_at
    for candle in candles:
        t, o, high, low = candle[:4]
        if t < entry_at:
            continue
        if t >= stage_end:
            break
        if t != expected:
            raise ValueError('Noncontiguous label path')
        expected += MINUTE
        if candle[5] <= 0:
            # No executable touch is inferred from an empty candle.
            continue
        opened_stop = (o - stop) * side <= 0
        opened_target = (o - target) * side >= 0
        if opened_stop or opened_target:
            return {'status': 'resolved', 'y': int(opened_stop), 'labelAt': t + MINUTE,
                    'reason': 'stop_gap' if opened_stop else 'target_gap'}
        stop_hit = low <= stop if side == 1 else high >= stop
        target_hit = high >= target if side == 1 else low <= target
        if stop_hit and target_hit:
            return {'status': 'ambiguous', 'y': None, 'labelAt': t + MINUTE, 'reason': 'both_same_minute'}
        if stop_hit or target_hit:
            return {'status': 'resolved', 'y': int(stop_hit), 'labelAt': t + MINUTE,
                    'reason': 'stop_first' if stop_hit else 'target_first'}
    if expected != stage_end:
        raise ValueError('Incomplete label calendar')
    return {'status': 'censored', 'y': None, 'labelAt': stage_end, 'reason': 'unresolved_at_stage_end'}


def stage_at(at, stages):
    for stage in stages:
        if stamp(stage['start']) <= at < stamp(stage['end']):
            return stage
    raise ValueError('Entry outside registered stages')


def chronological_masks(rows, start, boundary, end):
    a, b, c = map(stamp, [start, boundary, end])
    # Thirty-minute additional gap after full label maturity.
    fit = np.array([a <= r['decisionAt'] < b and r['labelAt'] <= b - 30 * MINUTE for r in rows])
    valid = np.array([b <= r['decisionAt'] < c and r['labelAt'] <= c for r in rows])
    return fit, valid


def make_pipeline(family, mode, selector_c, parameter, protocol):
    steps = [('scale', StandardScaler())]
    if mode == 'selected':
        steps.append(('select', ProtectedL1Selector(C=selector_c, protected=tuple(protocol['protectedIndices']),
                                                    seed=protocol['seed'], max_iter=2000, tol=0.001)))
    if family == 'logistic':
        clf = LogisticRegression(C=parameter, max_iter=2000, random_state=protocol['seed'])
    elif family == 'boosting':
        clf = HistGradientBoostingClassifier(learning_rate=0.05, max_iter=100, max_leaf_nodes=parameter,
                                             min_samples_leaf=10, l2_regularization=1.0,
                                             max_bins=64, early_stopping=False, random_state=protocol['seed'])
    else:
        raise ValueError('Unknown family')
    steps.append(('classifier', clf))
    return Pipeline(steps)


def binary_metrics(y, p):
    y, p = np.asarray(y), np.asarray(p)
    if len(y) == 0 or p.shape != y.shape or not np.isfinite(p).all() or np.any((p < 0) | (p > 1)):
        raise ValueError('Invalid binary predictions')
    cm = confusion_matrix(y, p >= .5, labels=[0, 1])
    support = cm.sum(axis=1)
    both = bool(np.all(support > 0))
    bins = []
    for i in range(10):
        mask = (p >= i / 10) & ((p < (i + 1) / 10) if i < 9 else (p <= 1))
        if mask.any():
            bins.append({'lower': i / 10, 'upper': (i + 1) / 10, 'count': int(mask.sum()),
                         'predicted': float(p[mask].mean()), 'observed': float(y[mask].mean())})
    return {'predictions': len(y), 'stopPrevalence': float(y.mean()),
            'brier': float(brier_score_loss(y, p)),
            'logLoss': float(log_loss(y, np.column_stack([1-p, p]), labels=[0, 1])),
            'balancedAccuracy': float(balanced_accuracy_score(y, p >= .5)) if both else None,
            'rocAUC': float(roc_auc_score(y, p)) if both else None,
            'averagePrecision': float(average_precision_score(y, p)) if both else None,
            'confusionMatrix': cm.tolist(), 'classCounts': support.tolist(),
            'classRecall': [float(cm[i, i] / support[i]) if support[i] else None for i in range(2)],
            'calibration': bins}


def sample_gate(parts, requirements):
    failures = []
    for name, rows in parts.items():
        counts = np.bincount([r['y'] for r in rows], minlength=2)
        req = requirements[name]
        if len(rows) < req['rows'] or min(counts) < req['perClass']:
            failures.append({'stage': name, 'rows': len(rows), 'classCounts': counts.tolist(), 'required': req})
    return {'passed': not failures, 'failures': failures,
            'note': 'Preregistered screening floor, not a statistical power calculation or promotion criterion.'}


def step4_gate(state, checkpoint):
    complete = (state.get('status') == 'complete_training_final_locked'
                and state.get('generation', 0) >= 1000 and checkpoint.get('generation', 0) >= 1000)
    return {'status': 'ready_for_separate_protocol' if complete else 'waiting_for_1000_generations',
            'generation': state.get('generation'), 'requiredGeneration': 1000,
            'trainingComplete': complete, 'started': False, 'ppoFilterEnabled': False,
            'note': 'Financial comparison remains a separate experiment; no automatic promotion.'}
