import sys
import unittest
from pathlib import Path
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
import joblib

sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
import pepe_entry_risk as c


class EntryRiskTests(unittest.TestCase):
    def trade(self,side=1):
        return {'side':side,'entryAt':0,'entry':100,'initialStop':100-side*10,'strategyTarget':100+side*20}

    def test_first_touch_and_ambiguous_order(self):
        self.assertEqual(c.reference_label(self.trade(),[[0,100,121,95,110,1]],60000)['y'],0)
        self.assertEqual(c.reference_label(self.trade(),[[0,100,105,89,95,1]],60000)['y'],1)
        self.assertEqual(c.reference_label(self.trade(-1),[[0,100,111,95,105,1]],60000)['y'],1)
        self.assertEqual(c.reference_label(self.trade(),[[0,100,121,89,105,1]],60000)['status'],'ambiguous')

    def test_gap_precedes_intraminute_range(self):
        r=c.reference_label(self.trade(),[[0,89,125,85,100,1]],60000)
        self.assertEqual((r['y'],r['reason']),(1,'stop_gap'))

    def test_no_deadline_but_stage_censoring_and_complete_path(self):
        quiet=[[i*60000,100,105,95,100,1] for i in range(75)]
        self.assertEqual(c.reference_label(self.trade(),quiet,75*60000)['status'],'censored')
        self.assertEqual(c.reference_label(self.trade(),quiet+[[75*60000,100,121,95,110,1]],76*60000)['y'],0)
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            c.reference_label(self.trade(),quiet,76*60000)
        with self.assertRaisesRegex(ValueError,'Noncontiguous'):
            c.reference_label(self.trade(),quiet[1:],75*60000)

    def test_empty_minute_not_executable(self):
        r=c.reference_label(self.trade(),[[0,100,130,80,100,0],[60000,100,121,95,110,1]],120000)
        self.assertEqual((r['y'],r['labelAt']),(0,120000))

    def test_chronology_purges_label_maturity(self):
        b=c.stamp('2025-02')
        rows=[{'decisionAt':b-3600000,'labelAt':b+60000},
              {'decisionAt':b-3600000,'labelAt':b-3600000},
              {'decisionAt':b,'labelAt':b+60000}]
        fit,valid=c.chronological_masks(rows,'2025-01','2025-02','2025-03')
        self.assertEqual(fit.tolist(),[False,True,False]);self.assertEqual(valid.tolist(),[False,False,True])

    def test_calibration_does_not_refit_and_protected_fields_retained(self):
        rng=np.random.default_rng(19);x=rng.normal(size=(250,16));x[:,12:15]=1;y=(x[:,1]+rng.normal(size=250)>.1).astype(int)
        p={'protectedIndices':[12,13,14,15],'seed':19}
        for family,parameter in [('logistic',1),('boosting',3)]:
            model=c.make_pipeline(family,'selected',.01,parameter,p).fit(x[:150],y[:150])
            before=joblib.hash(model)
            calibrated=CalibratedClassifierCV(FrozenEstimator(model),method='sigmoid').fit(x[150:200],y[150:200])
            self.assertEqual(joblib.hash(model),before)
            self.assertTrue(model.named_steps['select'].get_support()[[12,13,14,15]].all())
            prob=calibrated.predict_proba(x[200:])[:,1]
            self.assertEqual(c.binary_metrics(y[200:],prob)['predictions'],50)

    def test_missing_class_is_not_a_valid_balanced_accuracy(self):
        result=c.binary_metrics(np.ones(5,dtype=int),np.full(5,.6))
        self.assertIsNone(result['balancedAccuracy']);self.assertIsNone(result['rocAUC'])
        self.assertEqual(result['classCounts'],[0,5])

    def test_step4_requires_completed_1000_and_not_a_pause(self):
        self.assertFalse(c.step4_gate({'status':'training','generation':1000},{'generation':1000})['trainingComplete'])
        self.assertFalse(c.step4_gate({'status':'complete_training_final_locked','generation':999},{'generation':1000})['trainingComplete'])
        gate=c.step4_gate({'status':'complete_training_final_locked','generation':1000},{'generation':1000})
        self.assertTrue(gate['trainingComplete']);self.assertFalse(gate['started'])


if __name__=='__main__':unittest.main()
