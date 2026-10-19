"""Rescue the validated G151 champion and prepare an independent generation-zero run."""
import argparse,copy,hashlib,importlib.util,json,shutil,zipfile
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('v4_seed_helpers',ROOT/'scripts/adaptive-genetic.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,obj):p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--run-id',required=True);a=ap.parse_args()
 if not a.run_id.startswith('search-v4-') or not all(c.isalnum() or c in '-_' for c in a.run_id):raise ValueError('Run inválido')
 source=ROOT/'work/local-ml/runs/search-v3-20261018T183222773Z';report=read(source/'report.json');winner=report['winner'];g=winner['genome']
 if g['id']!='c6cb2a8370cd058b0be0' or abs(winner['fitnessUSDT']*5-18.402207221636612)>1e-9:raise ValueError('Campeão inesperado')
 bundle=ROOT/'champions'/('g151-'+g['id']);run=ROOT/'work/local-ml/runs'/a.run_id
 if run.exists() or bundle.exists():raise ValueError('Destino já existe; não sobrescrever resgate')
 bundle.mkdir(parents=True);run.mkdir(parents=True);cache=read(source/'model-cache.json');newcache={};mapping=[]
 for family,hold in sorted({(arm['family'],arm['hold']) for arm in g['routes'].values() if arm['family']}):
  key=old.model_key(g,family,hold);paths=[]
  for original in cache[key]:
   original=Path(original);prediction=read(original);artifact=ROOT/prediction['artifact']
   if sha(artifact)!=prediction['artifactSHA256']:raise ValueError('Modelo original corrompido')
   saved_prediction=bundle/'predictions'/original.name;saved_model=bundle/'models'/artifact.name
   for src,dst in [(original,saved_prediction),(artifact,saved_model)]:
    dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
    if sha(src)!=sha(dst):raise ValueError('Cópia divergente')
   newmodel=run/'models'/artifact.name;newmodel.parent.mkdir(exist_ok=True);shutil.copy2(saved_model,newmodel)
   newprediction={**prediction,'artifact':str(newmodel.relative_to(ROOT))};target=run/'predictions'/original.name;write(target,newprediction);paths.append(str(target))
   mapping.append({'originalPrediction':str(original.relative_to(ROOT)),'savedPrediction':str(saved_prediction.relative_to(bundle)),'originalModel':prediction['artifact'],'savedModel':str(saved_model.relative_to(bundle)),'modelSHA256':sha(saved_model),'predictionSHA256':sha(saved_prediction)})
  newcache[key]=paths
 write(run/'model-cache.json',newcache);write(bundle/'winner.json',{'sourceRun':source.name,'originalRecordGeneration':151,'finalCompletedGeneration':report['generation'],'winner':winner,'frozenAt':datetime.now(timezone.utc).isoformat(),'realOrders':False});write(bundle/'prediction-mapping.json',mapping)
 for hold in read(source/'registration.json')['protocol']['holdingMinutes']:
  src=source/'labels'/f'hold-{hold}.json'
  for dest in [bundle/'labels'/src.name,run/'labels'/src.name]:dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
 # Keep all numeric decisions and trial scores; only bulky disposable artifacts will later be pruned.
 for folder in (ROOT/'work/local-ml/runs').iterdir():
  if not folder.is_dir() or folder==run:continue
  target=bundle/'prior-runs'/folder.name;target.mkdir(parents=True,exist_ok=True)
  for f in folder.iterdir():
   if f.is_file() and not f.is_symlink() and f.suffix=='.json':shutil.copy2(f,target/f.name)
 for name in ['scripts/adaptive-search-v3.py','scripts/search-v3-operators.py','scripts/adaptive-genetic.py','scripts/train-local-ml.py','scripts/train-local-ml-extended.py','scripts/build-adaptive-labels.mjs','scripts/score-adaptive-genetic.mjs','scripts/local-ml-evaluation.mjs','scripts/extended-ml-utils.mjs','web/adaptive-engine.js','web/adaptive-policy.js','web/compound-math.js','scalping-protocol.json','adaptive-search-v3-protocol.json','adaptive-genetic-protocol.json','data/scalp-tree/features.json','data/scalp-tree/manifest.json']:
  dst=bundle/'sources'/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dst)
 shutil.copytree(ROOT/'web/pesquisa-genetica/acompanhamento',bundle/'reports')
 shutil.copy2(ROOT/'work/research-monitor/state.json',bundle/'previous-monitor-state.json')
 archive_rows=read(source/'evolution.json').get('searchArchive',[]);write(run/'seed-archive.json',archive_rows)
 write(run/'seed-winner.json',winner);write(run/'seed-origin.json',{'sourceRun':source.name,'sourceGeneration':151,'sourceBundle':str(bundle.relative_to(ROOT)),'sourceReportSHA256':sha(source/'report.json'),'expectedMonthlyBRL':winner['fitnessUSDT']*5,'note':'Nova campanha; G0 contém somente o campeão, reavaliado com as mesmas predições, dados e custos. Pais de outros algoritmos são sementes de exploração daG1 em diante.'})
 (bundle/'README.md').write_text('# Campeão preservado · G151\n\nRandom Forest, validação R$18,402207/mês sobre R$1.000; 35operações,8/9meses positivos, drawdown mensal máximo2,7463%. São dados históricos de seleção, sem ordens reais.\n\nContém30modelos, predições originais,6conjuntos de rótulos, fontes e metadados das rodadas anteriores. O manifesto SHA256 permite conferir cada cópia. Os candles e a base local de simulação permanecem no projeto. Modelos descartados são reproduzíveis por parâmetros/sementes registrados, mas os seus binários podem ser removidos na limpeza autorizada.\n\nA novaG0 será aceita somente se a simulação reproduzir o mesmo valor com tolerância1e-9.\n')
 manifest={str(f.relative_to(bundle)):sha(f) for f in bundle.rglob('*') if f.is_file()};write(bundle/'manifest.json',manifest)
 for f,h in manifest.items():
  if sha(bundle/f)!=h:raise ValueError('Resgate não verificou '+f)
 archive=ROOT.parent/'trend-lab-campeao-g151.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
  for f in bundle.rglob('*'):
   if f.is_file():z.write(f,str(f.relative_to(bundle)))
 with zipfile.ZipFile(archive) as z:
  if z.testzip():raise ValueError('ZIP corrompido')
 write(ROOT/'work/search-v4-prepared.json',{'runId':a.run_id,'bundle':str(bundle.relative_to(ROOT)),'bundleManifestSHA256':sha(bundle/'manifest.json'),'archive':str(archive),'archiveSHA256':sha(archive),'models':len(mapping),'filesVerified':len(manifest)})
 print(json.dumps({'runId':a.run_id,'modelsPreserved':len(mapping),'filesVerified':len(manifest),'bundle':str(bundle.relative_to(ROOT)),'zipBytes':archive.stat().st_size}))
if __name__=='__main__':main()
