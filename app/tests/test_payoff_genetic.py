import sys,unittest,random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from payoff_genetic_core import founder,validate,identity,columns,mutate,initial_population,evolve,score
from payoff_entry_core import mature_rows
class GeneticTests(unittest.TestCase):
    def test_genomes_mutate_within_registered_space_and_never_drop_all_features(self):
        r=random.Random(17);g=founder();self.assertEqual(len(columns(g)),19)
        for _ in range(1000):
            h=mutate(g,r,.45);self.assertNotEqual(h,g);validate(h);self.assertGreater(len(columns(h)),0);g=h
        with self.assertRaises(ValueError):validate({**g,'risk':.2})
    def test_identical_phenotypes_have_canonical_identity(self):
        g=founder();self.assertEqual(identity(g),identity(dict(reversed(list(g.items())))));self.assertNotEqual(identity(g),identity(mutate(g,random.Random(1))))
    def test_island_size_founder_and_adaptive_diversity_survive_migration(self):
        p=initial_population(17);r={identity(v['genome']):{'fitness':-i}for i,v in enumerate(p)};new,ops=evolve(p,r,17,5,8)
        self.assertEqual(len(new),256);self.assertTrue(ops['expanded']);self.assertTrue(ops['migration']);self.assertTrue(any(v['genome']==founder()for v in new if v['island']==0))
        for island in range(4):self.assertEqual(sum(v['island']==island for v in new),64)
    def test_selection_penalizes_single_month_spike_and_drawdown(self):
        make=lambda pnl,dd=0:{'pnlBRL':pnl,'maxDD':dd,'count':10,'cdi':{'pnlBRL':10}}
        steady=score([make(20)for _ in range(4)],founder());spike=score([make(v)for v in [0,0,0,200]],founder())
        self.assertGreater(steady['fitness'],spike['fitness']);self.assertGreater(steady['fitness'],score([make(20,.1)for _ in range(4)],founder())['fitness']);self.assertTrue(steady['supportSufficient'])
        cash=score([make(0)for _ in range(4)],founder());self.assertLess(cash['fitness'],0)
    def test_calibration_and_train_labels_must_mature_before_next_block(self):
        end=10000000;r={'side':1,'at':1,'exitAt':end,'x':[0]*19};self.assertEqual(mature_rows([r],1,end),[]);r['exitAt']=end-1800000;self.assertEqual(len(mature_rows([r],1,end)),1)
if __name__=='__main__':unittest.main()
