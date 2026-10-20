"""Operational scheduling only; fake jobs never touch model state."""
import importlib, sys, threading, time, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
m=importlib.import_module('run-pepe-mask-ultra')
CONFIG={'profiles':{'eco':{'workers':1},'boost':{'workers':3},'ultra':{'workers':5}},'maximumWorkers':5,'threadsPerWorker':2,'memorySoftPercent':20,'memoryCriticalPercent':12}
class FakeWorker:
 def __init__(self,n):self.n=n;self.closed=0
 def call(self,job):time.sleep(.002);return job*2
 def close(self):self.closed+=1
class RuntimeTests(unittest.TestCase):
 def test_modes_lease_and_memory(self):
  for mode,count in [('eco',1),('boost',3),('ultra',5)]:
   c=m.effective_capacity({'mode':mode,'ultraExpiresAt':200},CONFIG,100,30);self.assertEqual(c['workers'],count);self.assertEqual(c['threadsPerWorker'],2)
  for control in [{'mode':'ultra'},{'mode':'ultra','ultraExpiresAt':100}]:self.assertEqual(m.effective_capacity(control,CONFIG,100,30)['effectiveMode'],'eco')
  for memory,count in [(19,3),(11,1)]:self.assertEqual(m.effective_capacity({'mode':'ultra','ultraExpiresAt':200},CONFIG,100,memory)['workers'],count)
 def run_jobs(self,jobs,capacity=lambda:5,paused=lambda:False,accept=None,workers=None):
  values=[];workers=workers or [FakeWorker(i)for i in range(5)]
  m.dispatch(jobs,accept or (lambda value,job,w:values.append((job,value,w.n))),workers,lock=threading.Lock(),capacity=capacity,paused=paused,guard=lambda:None,sleep=lambda _:time.sleep(.001))
  return values
 def test_exactly_once_and_all_five_lanes(self):
  rows=self.run_jobs(list(range(100)));self.assertEqual(sorted(x[0]for x in rows),list(range(100)));self.assertEqual({x[2]for x in rows},set(range(5)))
 def test_light_and_empty_queue_finish(self):
  self.assertEqual(self.run_jobs([]),[]);rows=self.run_jobs(list(range(10)),capacity=lambda:1);self.assertEqual({x[2]for x in rows},{0})
 def test_hot_capacity_changes(self):
  capacity=[1];rows=[]
  def accept(value,job,w):
   rows.append(job)
   if len(rows)==2:capacity[0]=5
   if len(rows)==15:capacity[0]=1
  self.run_jobs(list(range(30)),capacity=lambda:capacity[0],accept=accept);self.assertEqual(sorted(rows),list(range(30)))
 def test_pause_finishes_inflight_without_dispatching_more(self):
  stop=[False];rows=[]
  def accept(value,job,w):rows.append(job);stop[0]=True
  self.run_jobs(list(range(100)),paused=lambda:stop[0],accept=accept);self.assertGreater(len(rows),0);self.assertLessEqual(len(rows),5)
 def test_error_does_not_hang_inactive_lanes(self):
  class Broken(FakeWorker):
   def call(self,job):raise RuntimeError('fake failure')
  with self.assertRaisesRegex(RuntimeError,'fake failure'):self.run_jobs([1,2],capacity=lambda:1,workers=[Broken(0),FakeWorker(1)])
if __name__=='__main__':unittest.main()
