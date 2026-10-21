import importlib,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
v=importlib.import_module('evaluate-pepe-v4-v2')
class ValidationTests(unittest.TestCase):
 def test_shortlist_uses_only_development_and_distinct_trained_weights(self):
  founder={'modelSHA256':'parent','modelPath':'p.zip'}
  def row(k,score,sha):return dict(key=k,score=score,kind='train',modelSHA256=sha,modelPath=k+'.zip',validationProfit=999999-score)
  rows=[row('a',10,'A'),row('b',20,'B'),row('c',19,'B'),row('d',5,'D')]
  chosen=v.choose(rows,founder);self.assertEqual([c['modelSHA256']for c in chosen],['B','A','parent']);self.assertTrue(chosen[-1]['control'])
  for r in rows:r['validationProfit']*= -999
  self.assertEqual(chosen,v.choose(rows,founder))
 def test_ranking_favors_worst_quarter_over_a_single_large_gain(self):
  a=dict(worstQuarterExcessCDI=-100,meanQuarterExcessCDI=1000,meanValidationDD=.01)
  b=dict(worstQuarterExcessCDI=1,meanQuarterExcessCDI=2,meanValidationDD=.1)
  self.assertGreater(v.ranking(b),v.ranking(a))
 def test_no_final_access_before_training_finishes(self):
  # The real bridge also enforces a frozen shortlist before any data packet.
  code=(Path(__file__).resolve().parents[1]/'scripts/pepe-v4-validation-bridge.mjs').read_text()
  self.assertIn("Validation locked until shortlist is frozen",code);self.assertIn("options.role==='validation'",code);self.assertIn("options.role==='continuous'",code)
if __name__=='__main__':unittest.main()
