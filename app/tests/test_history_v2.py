import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('history_v2',Path(__file__).resolve().parent.parent/'scripts/collect-full-history-v2.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Aggregation(unittest.TestCase):
    def rows(self,n):return[[i*60000,100+i,102+i,99+i,101+i,10,1000,4]for i in range(n)]
    def test_ohlc_and_volume_are_aggregated_not_interpolated(self):
        rows,skipped=m.aggregate(self.rows(6),3);self.assertEqual(len(rows),2);self.assertEqual(rows[0],[0,100,104,99,103,30,3000,12]);self.assertEqual(skipped,0)
    def test_missing_minute_discards_whole_bucket_without_bridging(self):
        source=self.rows(6);source.pop(1);rows,skipped=m.aggregate(source,3);self.assertEqual([r[0]for r in rows],[180000]);self.assertEqual(skipped,1)
    def test_partial_tail_and_unaligned_head_are_not_complete_candles(self):
        rows,skipped=m.aggregate(self.rows(7)[1:],3);self.assertEqual([r[0]for r in rows],[180000]);self.assertEqual(skipped,2)
    def test_gaps_preserve_actual_unavailable_period(self):
        rows=self.rows(4);rows.pop(1);self.assertEqual(m.gaps(rows,0,240000),[{'start':60000,'end':120000,'missing':1}])
if __name__=='__main__':unittest.main()
