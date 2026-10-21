import sys,unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from payoff_entry_core import mature_rows,expected_payoff,logit,score_bin

class PayoffEntryTests(unittest.TestCase):
    def test_sixty_percent_accuracy_can_still_have_negative_net_expectancy(self):
        self.assertAlmostEqual(float(expected_payoff(.6,.37,.89)),-.134)
        self.assertGreater(float(expected_payoff(.8,.37,.89)),0)

    def test_maturity_embargo_purges_outcomes_after_the_stage_end(self):
        end=10000000;cut=end-30*60000
        make=lambda at,exit_at,side:{'at':at,'exitAt':exit_at,'side':side,'x':[0.]*19}
        good=make(cut-60000,cut,1)
        self.assertEqual(mature_rows([good,make(cut-60000,cut+1,1),make(cut,cut,1),make(cut-60000,cut,-1)],1,end),[good])

    def test_missing_features_and_impossible_labels_are_rejected(self):
        r={'at':1,'exitAt':0,'side':1,'x':[0.]*19}
        with self.assertRaises(ValueError):mature_rows([r],1,10000000)
        r['exitAt']=2;r['x']=[0.]*18
        with self.assertRaises(ValueError):mature_rows([r],1,10000000)

    def test_net_targets_are_not_charged_costs_twice_and_zero_loss_is_allowed(self):
        np.testing.assert_allclose(expected_payoff([1,0,.5],[.2,.2,.2],[.8,.8,0]),[.2,-.8,.1])
        for args in [(1.1,1,1),(.5,-1,1),(.5,1,-1),(.5,float('nan'),1)]:
            with self.assertRaises(ValueError):expected_payoff(*args)

    def test_fixed_bins_and_logit_are_finite_at_probability_extremes(self):
        self.assertEqual([score_bin(v) for v in [-1,0,.1,.25,.26]],['nonpositive','nonpositive','zeroTo01','01To025','above025'])
        self.assertTrue(np.isfinite(logit([0,.5,1])).all())
        with self.assertRaises(ValueError):score_bin(float('nan'))

if __name__=='__main__':unittest.main()
