import importlib,sys,unittest,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'));core=importlib.import_module('pepe-elite-core')
class EliteTests(unittest.TestCase):
 def test_rejected_child_does_not_replace_incumbent(self):
  old={'score':10,'modelPath':'frozen.zip'};candidate={'score':-5,'modelPath':'child.zip'};snapshot=copy.deepcopy(old)
  chosen,accepted=core.promote('protected',candidate,old);self.assertIs(chosen,old);self.assertFalse(accepted);self.assertEqual(old,snapshot)
 def test_control_keeps_regression_for_a_fair_comparison(self):
  old={'score':10};candidate={'score':-5};chosen,accepted=core.promote('control',candidate,old);self.assertIs(chosen,candidate);self.assertTrue(accepted)
 def test_only_strict_score_improvement_is_promoted(self):
  old={'score':10}
  for score,accept in [(10,False),(10+1e-10,False),(10.01,True)]:self.assertEqual(core.promote('protected',{'score':score},old)[1],accept)
 def test_metrics_include_cash_and_rejected_candidates(self):
  def row(p,n):return{'score':p,'audit':{'pnlBRL':p,'count':n,'halted':p<0,'feesBRL':1,'slippageBRL':1,'grossBRL':p+1,'maxDD':.1}}
  result=core.summarize([row(-100,10),row(0,0),row(10,2)]);self.assertEqual(result['count'],3);self.assertEqual(result['meanPNL'],-30);self.assertEqual(result['medianPNL'],0);self.assertEqual(result['cash'],1)
 def test_resource_gate_respects_ultra_and_low_memory(self):
  for workers in [1,3]:self.assertTrue(core.capacity_ok({'status':'training','executionRuntime':{'workers':workers}},25))
  self.assertFalse(core.capacity_ok({'status':'training','executionRuntime':{'workers':5}},25));self.assertFalse(core.capacity_ok({},19));self.assertFalse(core.capacity_ok({},None))
 def test_same_seed_and_parent_for_both_arms(self):
  run=importlib.import_module('run-pepe-elite');run.P={'seed':20261021,'stepsPerRound':1024};p={'id':0,'modelPath':'p0.zip','modelSHA256':'abc','hyperparameters':{'gamma':.99}}
  a=run.job(p,1,arm='control',pair=2);b=run.job(p,1,arm='protected',pair=2)
  for field in ['seed','sourcePath','sourceSHA256','steps','hyperparameters']:self.assertEqual(a[field],b[field])
  self.assertEqual(run.job(p,1)['steps'],0);self.assertEqual(run.job(p,1)['kind'],'frozen')
if __name__=='__main__':unittest.main()
