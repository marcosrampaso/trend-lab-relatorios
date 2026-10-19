import copy,importlib.util,json,random,unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('search_v3_test',ROOT/'scripts/search-v3-operators.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SearchV3Tests(unittest.TestCase):
 def setUp(self):
  self.p=json.loads((ROOT/'adaptive-search-v3-protocol.json').read_text());rng=random.Random(8);self.rows=[]
  for i in range(80):
   g=m.old.random_genome(rng,self.p);g['algorithm']='hist_boosting' if i<60 else self.p['algorithms'][i%6];g['params']=m.old.default_params(g['algorithm'],rng);g=m.identify(g);self.rows.append({'genome':g,'eligible':True,'fitnessUSDT':100-i,'maxDD':.02,'positiveMonths':7})
  self.state={'population':self.rows,'searchArchive':self.rows,'best':self.rows[0],'stagnation':30,'seen':[r['genome']['id'] for r in self.rows]}
 def test_parent_selection_reserves_every_available_algorithm(self):
  parents=m.parent_pool(self.state,self.p,random.Random(1));self.assertEqual({r['genome']['algorithm'] for r in parents},set(self.p['algorithms']));self.assertEqual(parents[0],self.state['best']);self.assertEqual(len(parents),12)
 def test_population_is_balanced_instead_of_all_high_fitness_boosting(self):
  pool=m.diverse_pool(self.rows,30);counts=Counter(r['genome']['algorithm'] for r in pool);self.assertEqual(set(counts),set(self.p['algorithms']));self.assertLess(counts['hist_boosting'],20);self.assertEqual(pool[0],self.rows[0])
 def test_stagnation_preserves_local_refinement_and_has_unique_deterministic_children(self):
  children,mix=m.next_generation(self.state,self.p,51);self.assertEqual(len(children),64);self.assertEqual(len({g['id'] for g in children}),64);self.assertEqual(mix['lanes']['local'],24);self.assertEqual(mix['lanes']['immigrant'],16);self.assertEqual(set(mix['parentAlgorithms']),set(self.p['algorithms']));self.assertEqual((children,mix),m.next_generation(self.state,self.p,51));self.assertFalse(set(self.state['seen'])&{g['id'] for g in children})
 def test_fine_mutation_changes_at_most_one_coordinate_and_keeps_risk_out(self):
  before=copy.deepcopy(self.rows[0]['genome']);rng=random.Random(2)
  for _ in range(100):
   g=m.fine_mutation(before,rng,self.p);self.assertEqual(g['algorithm'],before['algorithm']);self.assertEqual(g['trainMonths'],before['trainMonths']);self.assertNotIn('risk',g);self.assertTrue(all(a['hold'] in self.p['holdingMinutes'] for a in g['routes'].values()))
  self.assertEqual(before,self.rows[0]['genome'])
 def test_behavior_duplicates_do_not_fill_parent_slots(self):
  a=copy.deepcopy(self.rows[0]);a['metrics']=[{'months':[{'month':'2025-06','base':{'pnlUSDT':1,'count':2,'maxDD':.01},'stress':{'pnlUSDT':.5,'count':2,'maxDD':.02}}]}];b=copy.deepcopy(a);b['genome']=m.identify({**b['genome'],'trendCut':1.1});self.assertEqual(m.behavior_key(a),m.behavior_key(b));self.assertEqual(len(m.diverse_pool([a,b],12)),1)
if __name__=='__main__':unittest.main()
