import copy,importlib.util,random,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('adaptive_test',Path(__file__).resolve().parents[1]/'scripts/adaptive-genetic.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AdaptiveTests(unittest.TestCase):
 def setUp(self):self.p=m.read(m.ROOT/'adaptive-genetic-protocol.json')
 def test_model_cache_does_not_depend_on_route_or_threshold(self):
  g=m.random_genome(random.Random(1),self.p);h=copy.deepcopy(g);h['routes']['range']['threshold']=.8;h['trendCut']=2
  self.assertEqual(m.model_key(g,'bands',60),m.model_key(h,'bands',60));self.assertNotEqual(m.identify(g)['id'],m.identify(h)['id']);h['trainMonths']=99;self.assertNotEqual(m.model_key(g,'bands',60),m.model_key(h,'bands',60))
 def test_mutation_changes_strategies_and_algorithms_without_risk_genes(self):
  rng=random.Random(4);g=m.random_genome(rng,self.p);before=copy.deepcopy(g);algos=set();families=set();holds=set()
  for _ in range(500):
   h=m.mutate(g,rng,self.p,True);algos.add(h['algorithm']);families.update(a['family'] for a in h['routes'].values());holds.update(a['hold'] for a in h['routes'].values());self.assertNotIn('risk',h);self.assertNotIn('capitalBRL',h);self.assertTrue(.0004<=h['volatilityCut']<=.006);self.assertTrue(.2<=h['trendCut']<=3);self.assertTrue(all(.2<=a['threshold']<=.85 for a in h['routes'].values()))
  self.assertEqual(g,before);self.assertEqual(algos,set(self.p['algorithms']));self.assertIn(None,families);self.assertIn(1440,holds)
 def test_stagnation_triggers_burst_and_restart_instead_of_termination(self):
  rng=random.Random(3);population=[{'genome':m.random_genome(rng,self.p),'eligible':True,'fitnessUSDT':-i,'maxDD':.1} for i in range(20)];state={'population':population,'stagnation':24,'seen':[r['genome']['id'] for r in population]};children,mix=m.next_generation(state,self.p,25)
  self.assertTrue(mix['burst']);self.assertTrue(mix['restart']);self.assertEqual(len(children),64);self.assertEqual(len({g['id'] for g in children}),64);self.assertGreater(mix['immigrants'],40);self.assertFalse(set(state['seen'])&{g['id'] for g in children});self.assertEqual(m.next_generation(state,self.p,25),(children,mix))
 def test_seed_selection_does_not_depend_on_test_profit(self):
  report={'protocol':{'configs':[{'id':'a','params':{'C':1}},{'id':'b','params':{'C':.1}}]},'trials':[]}
  for fold in self.p['validationFolds']:
   for c,score in [('a',1),('b',2)]:report['trials'].append({'fold':fold,'eligible':True,'algorithm':'logistic','family':'bands','hold':60,'trainMonths':9,'configId':c,'threshold':.4,'basePnL':score,'stressPnL':score,'testPnL':999 if c=='a' else -999})
  previous={'genome':{'family':'bands','hold':60,'trainMonths':9,'algorithm':'logistic','params':{'C':1},'threshold':.4}};a=m.seed_population(report,previous,self.p)
  for t in report['trials']:t['testPnL']*=-10000
  self.assertEqual(m.seed_population(report,previous,self.p),a);self.assertEqual(a[1][0]['genome']['params']['C'],.1)
if __name__=='__main__':unittest.main()
