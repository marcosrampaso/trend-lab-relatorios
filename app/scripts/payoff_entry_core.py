"""Causal stage boundaries and net payoff arithmetic, independent of training IO."""
import numpy as np

def mature_rows(rows, side, end, embargo_minutes=30):
    cutoff=end-embargo_minutes*60000
    out=[r for r in rows if r['side']==side and r['at']<cutoff and r['exitAt']<=cutoff]
    if any(r['exitAt']<r['at'] or len(r['x'])!=19 or not np.isfinite(r['x']).all() for r in out):
        raise ValueError('Invalid or future label')
    return out

def logit(probability):
    p=np.clip(np.asarray(probability,dtype=float),1e-6,1-1e-6)
    return np.log(p/(1-p)).reshape(-1,1)

def expected_payoff(probability, gain, loss):
    p=np.asarray(probability,dtype=float)
    g=np.asarray(gain,dtype=float)
    l=np.asarray(loss,dtype=float)
    if not (np.isfinite(p).all() and np.isfinite(g).all() and np.isfinite(l).all()):
        raise ValueError('Nonfinite payoff')
    if (p<0).any() or (p>1).any() or (g<0).any() or (l<0).any():
        raise ValueError('Invalid payoff components')
    return p*g-(1-p)*l

def score_bin(score):
    if not np.isfinite(score):
        raise ValueError('Nonfinite score')
    return 'nonpositive' if score<=0 else 'zeroTo01' if score<=.1 else '01To025' if score<=.25 else 'above025'
