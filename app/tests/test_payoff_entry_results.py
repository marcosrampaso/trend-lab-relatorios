import hashlib,json,sys,unittest
from pathlib import Path
import joblib
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from payoff_entry_core import logit,expected_payoff,mature_rows
BASE=ROOT/'work/pepe-payoff-entry-v1'
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()

class PayoffResultsTests(unittest.TestCase):
    def test_registered_inputs_and_model_artifacts_stay_immutable(self):
        reg=read(BASE/'registration.json');self.assertEqual(sha(BASE/'protocol.json'),reg['protocolSHA256'])
        for f,h in {**reg['inputs'],**reg['sourceHashes']}.items():self.assertEqual(sha(ROOT/f),h,f)
        alias=read(BASE/'import-alias.json');self.assertEqual(sha(ROOT/alias['alias']),sha(ROOT/alias['target']))
        for files in read(BASE/'training-complete.json')['models'].values():
            for f,h in files.items():self.assertEqual(sha(ROOT/f),h,f)

    def test_fit_stages_use_only_matured_prior_labels_and_have_reported_counts(self):
        p=read(BASE/'protocol.json')
        for side in p['sides']:
            for stage,months in [('train',p['trainMonths']),('calibration',p['probabilityCalibrationMonths']),('diagnostic',p['diagnosticMonths'])]:
                rows=[r for m in months for r in read(ROOT/p['specialists']/'labels'/f"{m['month']}.json")['rows']]
                expected=mature_rows(rows,side,p['cutoffs'][stage],p['embargoMinutes'])
                for family in p['families']:
                    info=read(BASE/'models'/f'{family}-{side}'/'metrics.json');m=info['stageMaturity'][stage]
                    self.assertEqual(m['count'],len(expected));self.assertLess(m['maxFeatureAt'],p['cutoffs'][stage]-1800000);self.assertLessEqual(m['maxExitAt'],p['cutoffs'][stage]-1800000)

    def test_all_frozen_forecasts_reproduce_probability_and_conditional_payoff_arithmetic(self):
        p=read(BASE/'protocol.json');grid=[r for m in p['months'] for r in read(ROOT/p['gridsParent']/'grids'/f"{m['month']}.json")['rows']];a=np.asarray([r['x'] for r in grid])
        for family in p['families']:
            for side in p['sides']:
                base=BASE/'models'/f'{family}-{side}';b=joblib.load(base/'model.joblib');pred=read(base/'predictions.json')['predictions']
                z=b['scaler'].transform(a) if b['scaler'] is not None else a
                raw=b['classifier'].predict_proba(z)[:,1];prob=b['calibrator'].predict_proba(logit(raw))[:,1]
                gain=np.full(len(a),b['constantGain']) if b['gain'] is None else np.maximum(0,b['gain'].predict(a));loss=np.full(len(a),b['constantLoss']) if b['loss'] is None else np.maximum(0,b['loss'].predict(a))
                np.testing.assert_allclose(prob,[r['probProfit']for r in pred],atol=1e-12);np.testing.assert_allclose(expected_payoff(prob,gain,loss),[r['netR']for r in pred],atol=1e-12)
                self.assertEqual([r['at']for r in pred],[r['at']for r in grid]);self.assertEqual(len(set(r['at']for r in pred)),len(pred))

    def test_all_metric_bins_reconcile_and_small_positive_tails_are_visible(self):
        p=read(BASE/'protocol.json')
        for family in p['families']:
            for side in p['sides']:
                m=read(BASE/'models'/f'{family}-{side}'/'metrics.json')
                for block in [*m['stages'].values(),*m['evaluation'].values()]:
                    self.assertEqual(sum(b['count']for b in block['bins']),block['count']);self.assertEqual(sum(b['count']for b in block['reliability']),block['count'])
                    self.assertEqual(sum(b['count']for b in block['bins']if b['bin']in['01To025','above025']),block['selected'])
                    for b in block['bins']:self.assertEqual(b['supported'],b['count']>=50)

if __name__=='__main__':unittest.main()
