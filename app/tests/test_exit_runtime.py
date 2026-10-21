import unittest,importlib,sys,ast
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'));runtime=importlib.import_module('exit-runtime')
class ExitRuntimeTests(unittest.TestCase):
 def test_ultra_requires_click_grant_and_live_lease(self):
  self.assertEqual(runtime.capacity({'mode':'boost'},100,30)['workers'],3)
  self.assertEqual(runtime.capacity({'mode':'ultra','ultraExpiresAt':200},100,30)['workers'],1)
  self.assertEqual(runtime.capacity({'mode':'ultra','ultraRequestedAt':50,'ultraExpiresAt':200},100,30)['workers'],5)
  self.assertEqual(runtime.capacity({'mode':'ultra','ultraRequestedAt':50,'ultraExpiresAt':100},100,30)['workers'],1)
 def test_threads_and_memory(self):
  for mem,n in [(30,5),(19,1),(11,0)]:
   r=runtime.capacity({'mode':'ultra','ultraRequestedAt':50,'ultraExpiresAt':200},100,mem);self.assertEqual((r['workers'],r['threadsPerWorker']),(n,2));self.assertFalse(r['scientificProtocolChanged'])
 def test_coordinator_changes_only_capacity_telemetry_and_worker_path(self):
  # AST equality covers dispatch, checkpoint queue, validation and bounded budget.
  def normalize(file):
   tree=ast.parse((ROOT/'scripts'/file).read_text());nodes=[]
   for n in tree.body:
    if isinstance(n,ast.Expr)and isinstance(n.value,ast.Constant)and isinstance(n.value.value,str):continue
    if isinstance(n,ast.FunctionDef)and n.name=='capacity':continue
    if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='runtime'for t in n.targets):continue
    nodes.append(n)
   tree.body=nodes
   class Normalize(ast.NodeTransformer):
    def visit_Constant(self,n):
     if n.value=='scripts/exit-lab-runtime-worker.py':n.value='scripts/exit-lab-worker.py'
     return n
    def visit_Dict(self,n):
     n=self.generic_visit(n);keep=[i for i,k in enumerate(n.keys)if not(isinstance(k,ast.Constant)and k.value=='executionRuntime')];n.keys=[n.keys[i]for i in keep];n.values=[n.values[i]for i in keep];return n
   return ast.dump(Normalize().visit(tree),include_attributes=False)
  self.assertEqual(normalize('run-exit-study.py'),normalize('run-exit-study-ultra.py'))
 def test_learning_loop_is_unchanged(self):
  old=(ROOT/'scripts/exit-lab-worker.py').read_text().split("def audit(steps):",1)[1]
  new=(ROOT/'scripts/exit-lab-runtime-worker.py').read_text().split("def audit(steps):",1)[1]
  self.assertEqual(old,new)
if __name__=='__main__':unittest.main()
