import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('local_trainer',Path(__file__).resolve().parents[1]/'scripts/train-local-ml.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TemporalTraining(unittest.TestCase):
 def test_purge_unavailable_labels(self):
  rows=[{'at':110,'labelAvailableAt':199},{'at':120,'labelAvailableAt':200},{'at':90,'labelAvailableAt':150},{'at':200,'labelAvailableAt':201}]
  self.assertEqual(m.temporal(rows,100,200),rows[:1])
 def test_estimators_avoid_random_internal_validation_and_nested_threads(self):
  protocol=m.read(m.ROOT/'local-ml-protocol.json')
  for config in protocol['configs']:
   model=m.estimator(config,42)
   last=model.steps[-1][1] if hasattr(model,'steps') else model
   if config['algorithm'] in ['hist_boosting','mlp']:self.assertFalse(last.early_stopping)
   if config['algorithm'] in ['random_forest','extra_trees']:self.assertEqual(last.n_jobs,1)
 def test_scaler_fits_only_rows_supplied_to_train(self):
  model=m.estimator({'algorithm':'logistic','params':{'C':1}},42)
  model.fit([[0],[2],[4],[6]],[0,0,1,1]);model.predict_proba([[1000]])
  self.assertEqual(model.steps[0][1].mean_[0],3)
if __name__=='__main__':unittest.main()
