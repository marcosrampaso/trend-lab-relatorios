"""Causal splits, protected feature selection and probability diagnostics."""
from datetime import datetime, timezone
import warnings
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.feature_selection import SelectFromModel
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import log_loss, balanced_accuracy_score, confusion_matrix

HORIZON_MS = 30 * 60000
DAY = 86400000


def stamp(month):
    return int(datetime.strptime(month, '%Y-%m').replace(tzinfo=timezone.utc).timestamp() * 1000)


def split_mask(times, period):
    start, end = map(stamp, period)
    return (times >= start) & (times + HORIZON_MS <= end)


def inner_masks(times, train_start, validation):
    start, end = map(stamp, validation)
    # An additional 30-minute separation beyond complete label maturity.
    train = (times >= stamp(train_start)) & (times + HORIZON_MS <= start - HORIZON_MS)
    valid = (times >= start) & (times + HORIZON_MS <= end)
    if not train.any() or not valid.any():
        raise ValueError('Empty chronological split')
    if set(times[train]).intersection(times[valid]):
        raise ValueError('Candidate directions crossed a split')
    return train, valid


class ProtectedL1Selector(TransformerMixin, BaseEstimator):
    def __init__(self, C=0.01, protected=(12, 13, 14, 15), seed=19, max_iter=1500, tol=0.001):
        self.C = C
        self.protected = protected
        self.seed = seed
        self.max_iter = max_iter
        self.tol = tol

    def fit(self, X, y):
        self.n_features_in_ = X.shape[1]
        estimator = LogisticRegression(C=self.C, l1_ratio=1.0, solver='saga',
                                       max_iter=self.max_iter, tol=self.tol, random_state=self.seed)
        with warnings.catch_warnings():
            warnings.simplefilter('error', ConvergenceWarning)
            estimator.fit(X, y)
        self.selector_ = SelectFromModel(estimator, prefit=True, threshold='mean')
        self.support_ = self.selector_.get_support().copy()
        self.support_[list(self.protected)] = True
        self.importances_ = np.abs(estimator.coef_).sum(axis=0)
        return self

    def transform(self, X):
        if X.shape[1] != self.n_features_in_:
            raise ValueError('Changed risk observation format')
        return X[:, self.support_]

    def get_support(self):
        return self.support_.copy()


def pipeline(family, mode, C, seed, config):
    steps = [('scale', StandardScaler())]
    if mode == 'selected':
        steps.append(('select', ProtectedL1Selector(C=C, protected=tuple(config['protectedIndices']),
                                                   seed=seed, max_iter=config['selection']['maxIter'],
                                                   tol=config['selection']['tol'])))
    if family == 'nb':
        model = GaussianNB(var_smoothing=config['classifiers']['nb']['varSmoothing'])
    elif family == 'logistic':
        model = LogisticRegression(C=config['classifiers']['logistic']['C'],
                                   max_iter=config['classifiers']['logistic']['maxIter'], random_state=seed)
    else:
        raise ValueError('Unknown classifier')
    steps.append(('classifier', model))
    return Pipeline(steps)


def require_classes(y):
    if set(np.unique(y)) != {0, 1, 2}:
        raise ValueError('Each temporal subset must contain all three risk classes')


def metrics(truth, probs, times=None):
    if probs.shape != (len(truth), 3) or not np.isfinite(probs).all():
        raise ValueError('Invalid probability matrix')
    if np.any(probs < 0) or not np.allclose(probs.sum(axis=1), 1):
        raise ValueError('Non-normalized probabilities')
    onehot = np.eye(3)[truth]
    risk = probs[:, 2]
    actual = (truth == 2).astype(float)
    bins = []
    for i in range(10):
        mask = (risk >= i / 10) & ((risk < (i + 1) / 10) if i < 9 else (risk <= 1))
        if mask.any():
            bins.append({'lower': i / 10, 'upper': (i + 1) / 10, 'count': int(mask.sum()),
                         'predicted': float(risk[mask].mean()), 'observed': float(actual[mask].mean())})
    cm = confusion_matrix(truth, probs.argmax(axis=1), labels=[0, 1, 2])
    result = {'brierMulticlass': float(np.mean(np.sum((probs - onehot) ** 2, axis=1))),
              'logLoss': float(log_loss(truth, probs, labels=[0, 1, 2])),
              'brierHighRisk': float(np.mean((risk - actual) ** 2)),
              'balancedAccuracy': float(balanced_accuracy_score(truth, probs.argmax(axis=1))),
              'classRecall': (np.diag(cm) / cm.sum(axis=1)).tolist(),
              'confusionMatrix': cm.tolist(), 'highRiskCalibration': bins, 'predictions': len(truth)}
    if times is not None:
        months = np.array([datetime.fromtimestamp(int(t) / 1000, timezone.utc).strftime('%Y-%m') for t in times])
        result['monthly'] = [{'month': m, **metrics(truth[months == m], probs[months == m])}
                             for m in np.unique(months)]
    return result


def brier_losses(truth, probs):
    return np.sum((probs - np.eye(3)[truth]) ** 2, axis=1)


def paired_daily_bootstrap(times, delta, repetitions=500, seed=20261020):
    days = times // DAY
    unique, inverse = np.unique(days, return_inverse=True)
    sums = np.bincount(inverse, weights=delta)
    counts = np.bincount(inverse)
    rng = np.random.default_rng(seed)
    samples = rng.integers(0, len(unique), (repetitions, len(unique)))
    values = sums[samples].sum(axis=1) / counts[samples].sum(axis=1)
    lo, hi = np.quantile(values, [.025, .975])
    return {'deltaBrier': float(delta.mean()), 'lower95': float(lo), 'upper95': float(hi),
            'days': len(unique), 'unit': 'UTC day, paired directions, seed-averaged case losses',
            'repetitions': repetitions}
