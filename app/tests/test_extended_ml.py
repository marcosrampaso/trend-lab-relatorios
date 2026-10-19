import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('extended',Path(__file__).resolve().parents[1]/'scripts/train-local-ml-extended.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ExtendedPlan(unittest.TestCase):
 def test_full_plan_unique_and_causal(self):
  p=m.read(m.ROOT/'local-ml-extended-protocol.json');tasks=m.task_plan(p)
  self.assertEqual(len(tasks),26640);self.assertEqual(len({t['id'] for t in tasks}),len(tasks))
  for t in tasks:self.assertGreaterEqual(m.month_at(t['fold'],-3-t['trainMonths']),m.month_at('2024-01'))
  self.assertEqual({t['hold'] for t in tasks},{30,60,120,240})
  self.assertFalse(any(t['fold']=='2025-01' and t['trainMonths']==12 for t in tasks))
 def test_plan_reproducible(self):
  p=m.read(m.ROOT/'local-ml-extended-protocol.json');self.assertEqual(m.task_plan(p),m.task_plan(p))
if __name__=='__main__':unittest.main()
