import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('expanded_validation',Path(__file__).resolve().parent.parent/'scripts/train-expanded-validation.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class TemporalMaturity(unittest.TestCase):
    def test_outcome_must_be_known_strictly_before_training_cutoff(self):
        rows=[{'at':10,'labelAvailableAt':19},{'at':11,'labelAvailableAt':20},{'at':12,'labelAvailableAt':21},{'at':0,'labelAvailableAt':9}]
        self.assertEqual(module.valid_train(rows,10,20),[rows[0]])
    def test_calendar_window_is_nine_months(self):
        self.assertEqual(module.at('2024-09',9),module.at('2025-06'))
if __name__=='__main__':unittest.main()
