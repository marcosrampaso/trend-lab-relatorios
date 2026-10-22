import importlib,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'));c=importlib.import_module('night-core')
class NightTests(unittest.TestCase):
 def test_every_fold_is_causal_and_all21_months_count(self):
  p=c.protocol();self.assertEqual(len(p['folds']),7);self.assertTrue(all(f['trainEnd']==f['start']for f in p['folds']));self.assertEqual(p['folds'][-1]['end'],p['validation']['start']);self.assertIsNone(p['maxWallHours']);self.assertFalse(p['realOrders'])
 def test_monthly_median_does_not_hide_losses_or_cash(self):
  refs=c.read(c.BASE/'benchmarks.json');blocks=[]
  for f in c.protocol()['folds']:
   ends=refs[str(f['id'])]['monthEnds'];v=[10,0,-20];curve=[{'at':f['start'],'brl':1000}];n=1000
   for at,d in zip(ends,v):n+=d;curve.append({'at':at,'brl':n})
   blocks.append({'fold':f['id'],'pnlBRL':-10,'curve':curve,'count':2,'maxDD':.02})
  s=c.temporal_summary(blocks,refs);self.assertEqual(len(s['monthlyPNL']),21);self.assertEqual(s['medianMonthlyBRL'],0);self.assertAlmostEqual(s['meanMonthlyBRL'],-10/3);self.assertLess(s['score'],0)
 def test_matching_fold_only_and_no_original_resume_change(self):
  src=(c.ROOT/'scripts/run-night-ppo.py').read_text();self.assertIn("parent['incumbent']['models']",src);self.assertIn("source=a['models'][fold]",src)
  new=(c.ROOT/'scripts/run-payoff200.py').read_text();self.assertIn("completedGenerations']<200",new);self.assertIn("completedGenerations')==200",new);self.assertIn('4182',new)
 def test_reference_scores_are_not_entry_veto(self):
  src=(c.ROOT/'scripts/night-bridge.mjs').read_text();self.assertIn('validActionMask(account.state()',src);self.assertNotIn('chooseSide',src);self.assertIn('row.available?1:0',src)
if __name__=='__main__':unittest.main()
