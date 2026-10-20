"""Behavior checks for temporal separation, protected signals and frozen calibration."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
import pepe_risk_selection as core
import json
CONFIG = json.loads((Path(__file__).resolve().parent.parent / 'pepe-risk-selection-protocol.json').read_text())


class RiskPipelineTests(unittest.TestCase):
    def test_time_splits_keep_candidate_pairs_and_mature_labels(self):
        at = np.repeat(np.arange(core.stamp('2023-06'), core.stamp('2024-03'), core.HORIZON_MS), 2)
        train, valid = core.inner_masks(at, '2023-06', ['2023-09', '2023-11'])
        self.assertLessEqual(at[train].max() + core.HORIZON_MS, at[valid].min() - core.HORIZON_MS)
        self.assertFalse(set(at[train]).intersection(at[valid]))
        self.assertTrue(np.all(train[::2] == train[1::2]))
        self.assertTrue(np.all(valid[::2] == valid[1::2]))
        self.assertFalse(np.any(core.split_mask(at, ['2023-06', '2023-09']) & valid))

    def test_selection_protects_constant_availability_and_direction(self):
        rng = np.random.default_rng(19)
        x = rng.normal(size=(900, 16))
        x[:, 12:15] = 1
        y = np.repeat([0, 1, 2], 300)
        x[:, 0] += y * 2
        selector = core.ProtectedL1Selector(C=.01).fit(x, y)
        self.assertTrue(selector.get_support()[12:16].all())
        self.assertEqual(selector.transform(x).shape[1], selector.get_support().sum())
        self.assertLess(selector.get_support().sum(), 16)

    def test_calibration_does_not_refit_scaler_selector_or_classifier(self):
        rng = np.random.default_rng(151)
        x = rng.normal(size=(900, 16)); y = np.repeat([0, 1, 2], 300)
        x[:, 0] += y
        model = core.pipeline('logistic', 'selected', .01, 19, CONFIG).fit(x, y)
        mean = model.named_steps['scale'].mean_.copy()
        selected = model.named_steps['select'].get_support().copy()
        coef = model.named_steps['classifier'].coef_.copy()
        calibration_x = x + .3
        calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid').fit(calibration_x, y)
        np.testing.assert_array_equal(mean, model.named_steps['scale'].mean_)
        np.testing.assert_array_equal(selected, model.named_steps['select'].get_support())
        np.testing.assert_array_equal(coef, model.named_steps['classifier'].coef_)
        p = calibrated.predict_proba(calibration_x)
        np.testing.assert_allclose(p.sum(axis=1), 1)
        self.assertEqual(p.shape, (900, 3))

    def test_probability_metrics_and_paired_daily_uncertainty(self):
        truth = np.array([0, 1, 2] * 10)
        perfect = np.eye(3)[truth]
        result = core.metrics(truth, perfect)
        self.assertEqual(result['brierMulticlass'], 0)
        self.assertEqual(result['balancedAccuracy'], 1)
        times = np.repeat(np.arange(10) * core.DAY, 3)
        comparison = core.paired_daily_bootstrap(times, np.full(30, -.01))
        self.assertAlmostEqual(comparison['deltaBrier'], -.01)
        self.assertAlmostEqual(comparison['lower95'], -.01)
        self.assertEqual(comparison['days'], 10)

    def test_no_overlapping_evaluation_periods_or_consumed_final(self):
        periods = [(core.stamp(f['evaluation'][0]), core.stamp(f['evaluation'][1])) for f in CONFIG['folds']]
        for i, (a, b) in enumerate(periods):
            self.assertLessEqual(b, core.stamp('2025-07'))
            for c, d in periods[i + 1:]:
                self.assertFalse(a < d and b > c)
        for fold in CONFIG['folds']:
            self.assertEqual(fold['fit'][1], fold['calibration'][0])
            self.assertEqual(fold['calibration'][1], fold['evaluation'][0])


if __name__ == '__main__':
    unittest.main()
