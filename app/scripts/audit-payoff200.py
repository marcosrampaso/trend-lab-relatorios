"""Invoked only after all200 selection generations; audit never feeds fitness."""
from pathlib import Path
import json,time
from payoff200_worker import ROOT,BASE,read,immutable,sha,initialize,block,fit_predict,choose
from payoff_entry_core import mature_rows
def audit(genome,wallet_rpc):
    initialize();p=read(BASE/'protocol.json');old=read(ROOT/p['parent']/'protocol.json');folder=BASE/'final-audit';folder.mkdir(exist_ok=True)
    if (folder/'result.json').exists():return read(folder/'result.json')
    grid=[];month_grids={}
    for m in p['auditMonths']:
        rows=read(ROOT/old['gridsParent']/'grids'/f"{m['month']}.json")['rows'];grid.extend(rows);month_grids[m['month']]=rows
    scores={};metadata={}
    for side in [1,-1]:
        train=block([m['month']for m in old['trainMonths']],side,old['cutoffs']['train'])
        cal=mature_rows([r for m in old['probabilityCalibrationMonths'] for r in read(ROOT/old['specialists']/'labels'/f"{m['month']}.json")['rows']],side,old['cutoffs']['calibration'],old['embargoMinutes'])
        # Each attempt archives to a new folder, preserving interrupted attempts.
        model=folder/f'side{side}-{time.time_ns()}.joblib';scores[side],metadata[side]=fit_predict(genome,train,cal,grid,p['seed']+side,model)
    forecasts=[{'at':f['at'],'month':next(m['month']for m in p['auditMonths']if m['start']<=f['at']<m['end']),'long':float(scores[1][i]),'short':float(scores[-1][i])}for i,f in enumerate(grid)]
    lookup={r['at']:r for r in forecasts};folds=[]
    for month,rows in month_grids.items():
        entries=[]
        for f in rows:
            v=lookup[f['at']];side=choose(v['long'],v['short'],p['threshold'])
            if side:entries.append({'at':f['at'],'atr':f['atr'],'side':side})
        folds.append({'month':month,'entries':entries})
    wallets=wallet_rpc({'folds':folds});result={'completedAt':int(time.time()*1000),'genome':genome,'wallets':wallets,'maturity':metadata,'forecastCount':len(forecasts),'independentValidation':False,'realOrders':False,'note':'Audit after selection completed. All calendars previously consumed; no new winner chosen here.'}
    immutable(folder/f'forecasts-{time.time_ns()}.json',forecasts);result['artifacts']={str(f.relative_to(ROOT)):sha(f)for f in folder.iterdir()if f.is_file()};immutable(folder/'result.json',result);return result
