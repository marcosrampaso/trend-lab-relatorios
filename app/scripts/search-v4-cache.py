"""Bounded artifact cache: preserve G0/current champion and diverse parents, never historical inputs."""
import hashlib,json,time
from pathlib import Path

def model_key(g,family,hold):
 return hashlib.sha256(json.dumps({'algorithm':g['algorithm'],'params':g['params'],'trainMonths':g['trainMonths'],'family':family,'hold':hold},sort_keys=True,separators=(',',':')).encode()).hexdigest()[:20]
def protected_keys(state,parents):
 return {model_key(row['genome'],a['family'],a['hold']) for row in [state.get('baseline'),state.get('best'),*parents] if row for a in row['genome']['routes'].values() if a['family'] and a['threshold']>0}
def cache_files(run):
 return [f for folder in ['models','predictions'] for f in (Path(run)/folder).glob('*') if f.is_file() and not f.is_symlink()]
def prune(run,state,cache,p,parents):
 run=Path(run);files=cache_files(run);size=sum(f.stat().st_size for f in files);before=size
 if size<=p['cacheSoftLimitGB']*1024**3:return {'beforeBytes':before,'afterBytes':size,'removedFiles':0,'protectedModels':len(protected_keys(state,parents))}
 protected=protected_keys(state,parents);keep={Path(v) for k,values in cache.items() if k in protected for v in values}
 keep_names={f.stem for f in keep};removed=[];target=p['cacheTargetGB']*1024**3
 # Model/prediction pairs share task IDs. Both must be evicted together.
 groups={}
 for f in files:groups.setdefault(f.stem,[]).append(f)
 for task,group in sorted(groups.items(),key=lambda kv:min(f.stat().st_mtime for f in kv[1])):
  if size<=target:break
  if task in keep_names:continue
  for f in group:
   if f.parent not in [run/'models',run/'predictions'] or f.is_symlink():raise ValueError('Cache fora do escopo')
   n=f.stat().st_size;removed.append({'path':str(f.relative_to(run)),'bytes':n,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()});f.unlink();size-=n
 for key in list(cache):
  if not all(Path(f).exists() for f in cache[key]):
   if key in protected:raise ValueError('Predição protegida removida')
   del cache[key]
 audit={'at':time.time(),'generation':state['generation'],'beforeBytes':before,'afterBytes':size,'removedFiles':len(removed),'protectedModels':len(protected),'files':removed}
 folder=run/'cache-audits';folder.mkdir(exist_ok=True);(folder/f'g{state["generation"]}.json').write_text(json.dumps(audit,separators=(',',':')))
 return {k:v for k,v in audit.items() if k!='files'}
