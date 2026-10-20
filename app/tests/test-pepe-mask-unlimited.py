import importlib,sys,unittest,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
m=importlib.import_module('run-pepe-mask-unlimited')
class UnlimitedTests(unittest.TestCase):
 def test_only_operational_time_is_unbounded(self):
  original=dict(m.runtime.core.P);publish_code=m.runtime._original_publish.__code__
  m.configure()
  self.assertEqual(m.runtime.core.P,original)
  self.assertEqual(m.runtime.core.P['maxWallHours'],48)
  self.assertTrue(math.isinf(m.runtime.legacy.P['maxWallHours']))
  self.assertEqual({k:v for k,v in m.runtime.legacy.P.items() if k!='maxWallHours'},{k:v for k,v in original.items() if k!='maxWallHours'})
  self.assertEqual(m.runtime.legacy.P['generations'],1000)
  self.assertIs(m.runtime._original_publish.__code__,publish_code)
  self.assertIs(m.runtime._original_publish.__globals__['P'],m.runtime.core.P)
if __name__=='__main__':unittest.main()
