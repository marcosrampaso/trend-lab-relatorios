"""Download pinned public safetensors and tokenizer, no remote Python execution."""
import hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ['HF_HOME']=str(ROOT/'work/huggingface-cache')
os.environ['TOKENIZERS_PARALLELISM']='false'
def main():
 from huggingface_hub import snapshot_download
 p=json.loads((ROOT/'multiasset-sentiment-protocol.json').read_text())['sentiment']
 target=ROOT/'work/local-sentiment/model'
 snapshot_download(p['model'],revision=p['revision'],local_dir=target,allow_patterns=['*.json','*.txt','merges.txt','vocab.json','model.safetensors','README.md'],token=False)
 files={str(f.relative_to(target)):hashlib.sha256(f.read_bytes()).hexdigest() for f in target.rglob('*') if f.is_file() and '.cache' not in f.parts}
 if 'model.safetensors' not in files:raise ValueError('Weights missing')
 (target.parent/'model-manifest.json').write_text(json.dumps({'model':p['model'],'revision':p['revision'],'files':files},indent=2))
 print(json.dumps({'downloaded':True,'revision':p['revision'],'files':len(files),'bytes':sum((target/f).stat().st_size for f in files)}),flush=True)
if __name__=='__main__':main()
