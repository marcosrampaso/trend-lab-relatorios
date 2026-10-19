import copy,importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
ops=module('v4_test_ops','scripts/search-v4-operators.py');cachemod=module('v4_test_cache','scripts/search-v4-cache.py')
class SearchV4Tests(unittest.TestCase):
 def setUp(self):
  self.p=json.loads((ROOT/'adaptive-search-v4-protocol.json').read_text());self.w=json.loads((ROOT/'work/champion-rescue-plan.json').read_text())['winner']
 def test_first_generation_does_not_replace_baseline_and_is_repeatable(self):
  state={'baseline':self.w,'best':self.w,'population':[self.w],'searchArchive':[self.w],'seen':[self.w['genome']['id']],'stagnation':0}
  a,mix=ops.next_generation(state,self.p,1);b,other=ops.next_generation(state,self.p,1)
  self.assertEqual(a,b);self.assertEqual(mix,other);self.assertEqual(len(a),64);self.assertEqual(len({g['id'] for g in a}),64);self.assertNotIn(self.w['genome']['id'],{g['id'] for g in a});self.assertEqual(state['baseline'],self.w)
 def test_registered_ablations_change_one_coordinate_except_named_model_swap(self):
  def flatten(d,prefix=''):
   return {k:v for name,value in d.items() if name!='id' for k,v in (flatten(value,prefix+name+'.').items() if isinstance(value,dict) else [(prefix+name,value)])}
  before=flatten(self.w['genome'])
  for g,label in ops.initial_variants(self.w['genome'],self.p):
   self.assertNotIn('risk',g);self.assertNotIn('leverage',g)
   if label.startswith('algorithm:'):continue
   after=flatten(g);changes=[k for k in before if before[k]!=after[k]];self.assertEqual(changes,[label])
 def test_protected_and_unrelated_files_survive_eviction(self):
  with tempfile.TemporaryDirectory() as tmp:
   run=Path(tmp);(run/'models').mkdir();(run/'predictions').mkdir();g=copy.deepcopy(self.w['genome']);g['routes']={k:{'family':'bands','hold':240,'threshold':.5} for k in ['range','trend','volatile']};w={'genome':g};key=cachemod.model_key(g,'bands',240);task=key+'-fold';old='obsolete-fold'
   for stem in [task,old]:
    (run/'models'/(stem+'.joblib')).write_bytes(b'm'*50);(run/'predictions'/(stem+'.json')).write_bytes(b'p'*50)
   keep=run/'unrelated.json';keep.write_text('history');cache={key:[str(run/'predictions'/(task+'.json'))],'old':[str(run/'predictions'/(old+'.json'))]}
   audit=cachemod.prune(run,{'baseline':w,'best':w,'generation':2},cache,{'cacheSoftLimitGB':150/1024**3,'cacheTargetGB':100/1024**3},[])
   self.assertEqual(audit['removedFiles'],2);self.assertTrue((run/'models'/(task+'.joblib')).exists());self.assertTrue(keep.exists());self.assertIn(key,cache);self.assertNotIn('old',cache)
 def test_fixed_risk_cost_and_validation_match_previous_campaign(self):
  old=json.loads((ROOT/'adaptive-search-v3-protocol.json').read_text())
  for key in ['capitalBRL','fx','risk','leverage','validationFolds','seeds','minimumTotalTradesBothCosts','minimumFoldTradesBothCosts','maximumValidationDrawdown']:
   self.assertEqual(self.p[key],old[key])
if __name__=='__main__':unittest.main()
