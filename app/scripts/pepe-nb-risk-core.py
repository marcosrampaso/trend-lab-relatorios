"""Risk labels are future outcomes only; never observations used at entry."""
import math
CLASSES=['baixo','moderado','alto']
HORIZON_MINUTES=30

def risk_label(side,entry,atr,candles):
 if side not in [-1,1]or not(entry>0 and atr>0)or len(candles)!=HORIZON_MINUTES:raise ValueError('Invalid risk-label horizon')
 distance=1.5*atr
 adverse=max(0,entry-min(r[3]for r in candles))if side==1 else max(0,max(r[2]for r in candles)-entry)
 ratio=adverse/distance
 return(0 if ratio<.5 else 1 if ratio<1 else 2),ratio

def features(row,side):
 # Functions differ: volatility, activity, reference price, context and direction.
 x=row['x'];values=[x[1],x[2],x[3],x[7],x[8],x[11],x[12],side]
 if not all(math.isfinite(v)for v in values):raise ValueError('Nonfinite causal feature')
 return values

def eligible_window(at,start,end):return start<=at and at+HORIZON_MINUTES*60000<=end
