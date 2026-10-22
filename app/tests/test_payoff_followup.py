import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from payoff_followup_core import wallet_summary, population_summary, continuation_gate


def wallet(month, positions, cdi=2):
    return {'month': month, 'pnlBRL': sum(positions), 'cdi': {'pnlBRL': cdi},
            'count': len(positions), 'trades': [{'net': n / 5} for n in positions], 'maxDD': .01}


class FollowupTests(unittest.TestCase):
    def test_cash_months_and_concentrated_winner(self):
        value = wallet_summary([wallet('a', [330, -10]), wallet('b', []), wallet('c', [-20]), wallet('d', [])], 5)
        self.assertEqual(value['monthlyNetBRL']['mean'], 75)
        self.assertEqual(value['monthlyNetBRL']['median'], 0)
        self.assertEqual(value['bestTwoShareOfPositivePNL'], 1)
        self.assertEqual(value['sumNetWithoutBestTwoBRL'], -30)
        self.assertEqual(value['meanMonthlyWithoutBestTwoBRL'], -7.5)
        self.assertFalse(continuation_gate(value, value)['eligibleForLargerResearchRun'])

    def test_concentration_sums_positions_not_exit_legs(self):
        value = wallet_summary([wallet('a', [4, 3, 2, -1])], 5)
        self.assertEqual(value['positions'], 4)
        self.assertEqual(value['sumNetWithoutBestTwoBRL'], 1)
        self.assertAlmostEqual(value['bestTwoShareOfPositivePNL'], 7 / 9)

    def test_reject_incomplete_ledger(self):
        w = wallet('a', [1])
        w['trades'] = []
        with self.assertRaises(ValueError):
            wallet_summary([w], 5)

    def test_population_weights_duplicates_and_cash(self):
        c = {k: {'id': k, 'meanMonthlyBRL': n, 'meanCDIBRL': 1,
                 'supportSufficient': False, 'count': int(n != 0)} for k, n in [('x', 9), ('y', 0)]}
        p = [{'genome': k} for k in ['x', 'y', 'y']]
        d = population_summary(p, c, lambda g: g)
        self.assertEqual(d['meanMonthlyNetBRL']['mean'], 3)
        self.assertEqual(d['meanMonthlyNetBRL']['median'], 0)
        self.assertEqual(d['zeroTradeIndividuals'], 2)

    def test_budget_gate_requires_breadth_and_support(self):
        good = wallet_summary([wallet(str(i), [3] * 10) for i in range(8)], 5)
        self.assertTrue(continuation_gate(good, good)['eligibleForLargerResearchRun'])
        good['positions'] = 2
        self.assertFalse(continuation_gate(good, good)['eligibleForLargerResearchRun'])


if __name__ == '__main__':
    unittest.main()
