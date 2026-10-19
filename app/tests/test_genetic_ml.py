import importlib.util,unittest,random,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('genetic_test',Path(__file__).resolve().parents[1]/'scripts/genetic-ml.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class GeneticTests(unittest.TestCase):
 def test_root_selection_ignores_test_profit(self):
  p=m.read(m.ROOT/'genetic-ml-protocol.json');trials=[]
  for fold in p['validationFolds']:
   for config,value,test in [('a',1,1000),('b',2,-1000)]:trials.append({'fold':fold,'eligible':True,'algorithm':'logistic','family':'bands','hold':60,'trainMonths':9,'configId':config,'threshold':.4,'basePnL':value,'stressPnL':value,'testPnL':test})
  report={'protocol':{'configs':[{'id':'a','params':{'C':.1}},{'id':'b','params':{'C':1}}]},'trials':trials};root=m.choose_root(report,p);self.assertEqual(root['baseConfigId'],'b')
  for t in trials:t['testPnL']*=1000000
  self.assertEqual(m.choose_root(report,p),root)
 def test_mutations_keep_risk_out_of_genome_and_obey_bounds(self):
  p=m.read(m.ROOT/'genetic-ml-protocol.json');parent=m.identify({'family':'bands','hold':60,'trainMonths':9,'algorithm':'random_forest','params':{'n_estimators':1200,'max_depth':5,'min_samples_leaf':50},'threshold':.4});before=copy.deepcopy(parent);rng=random.Random(12)
  for _ in range(100):
   child=m.mutate(parent,rng,p);self.assertEqual(child['family'],parent['family']);self.assertEqual(child['algorithm'],parent['algorithm']);self.assertNotIn('risk',child);self.assertTrue(.2<=child['threshold']<=.8);self.assertIn(child['hold'],[30,60,120,240]);self.assertTrue(400<=child['params']['n_estimators']<=2000)
  self.assertEqual(parent,before)
 def test_threshold_mutations_reuse_model_key(self):
  g=m.identify({'family':'cross','hold':30,'trainMonths':6,'algorithm':'logistic','params':{'C':1},'threshold':.4});h=m.identify({**g,'threshold':.5});self.assertNotEqual(g['id'],h['id']);self.assertEqual(m.model_key(g),m.model_key(h))
if __name__=='__main__':unittest.main()
