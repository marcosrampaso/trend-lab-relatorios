import importlib,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
c=importlib.import_module('pepe-v4-core')
class V4Tests(unittest.TestCase):
 def setUp(self):self.p={'fitnessBlocks':[{}, {}, {}],'drawdownPenalty':.25,'capitalBRL':1000,'worstLossPenalty':.25,'seed':123,'reproduceEvery':5,'replaceFraction':.2,'learningRates':[1e-6,1e-5,3e-4]}
 def block(self,pnl,dd=0,count=1):return {'summary':dict(pnlBRL=pnl,maxDD=dd,count=count,halted=False,grossBRL=pnl,feesBRL=0,slippageBRL=0,fundingBRL=0)}
 def test_selection_penalizes_bad_block_and_includes_cash(self):
  a=c.aggregate([self.block(300,.2),self.block(-100,.1),self.block(0,0,0)],self.p)
  self.assertAlmostEqual(a['pnlBRL'],200/3);self.assertAlmostEqual(a['score'],(250-125)/3-25);self.assertEqual(a['activeBlocks'],2);self.assertTrue(a['notACompoundedPortfolio'])
 def test_no_incomplete_audit(self):
  with self.assertRaises(ValueError):c.aggregate([self.block(300)],self.p)
 def test_retained_weights_only_change_on_strict_improvement(self):
  old={'score':1,'modelSHA256':'a'}
  for score in [0,1,1+1e-10]:self.assertIs(c.promote({'score':score},old)[0],old)
  self.assertTrue(c.promote({'score':2},old)[1])
 def test_reproduction_preserves_best_and_mutates_only_lr(self):
  agents=[{'id':i,'incumbent':{'score':i},'hyperparameters':{'learning_rate':1e-5,'gamma':.995}}for i in range(25)];best={'score':24,'modelSHA256':'frozen'}
  same,events=c.evolve(agents,best,4,self.p);self.assertFalse(events)
  new,events=c.evolve(agents,best,5,self.p);self.assertEqual(len(events),5)
  for a,b in zip(agents,new):
   self.assertGreaterEqual(b['incumbent']['score'],a['incumbent']['score']);self.assertEqual(b['hyperparameters']['gamma'],.995)
  self.assertEqual(agents[0]['incumbent']['score'],0)
if __name__=='__main__':unittest.main()
