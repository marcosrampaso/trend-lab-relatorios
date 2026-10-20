"""Register an isolated experiment and candidate inventory before financial ranking."""
import importlib,time
from pathlib import Path
c=importlib.import_module('pepe-mask-core');R,B,P=c.ROOT,c.RUN,c.P
B.mkdir(parents=True,exist_ok=True)
if(B/'registration.json').exists():raise SystemExit('Already registered; never overwrite registration')
files=['pepe-finrl-mask-protocol.json','scripts/pepe-mask-core.py','scripts/pepe-mask-worker.py','scripts/run-pepe-mask.py','scripts/prepare-pepe-mask.py','scripts/pepe_mask_env.py','scripts/pepe-mask-actions.mjs','scripts/pepe-mask-engine.mjs','scripts/pepe-mask-bridge.mjs','scripts/pepe_finrl_env.py','pepe-finrl-protocol.json','scripts/multiasset-io.mjs','scripts/donchian-research-summary-v4.mjs','scripts/cdi-scenarios.mjs','web/engine.js','web/scalping.js','web/scalp-tree.js','web/scalping-context.js','web/research-funding-buckets.js','data/pepe-finrl-v1/features/index.json','data/pepe-finrl-v1/exchange.json','requirements-local-rl.lock.txt']
inv=c.inventory();c.immutable_json(B/'parent-inventory.json',inv)
index=c.read(R/'data/pepe-finrl-v1/features/index.json');months=[m for m in index['months']if P['train']['start']<=m['month']<P['development']['end']and m['month']!='2024-08']
data={f:d for m in months for f,d in [(m['path'],m['sha256']),(m['rawPath'],m['rawSHA256'])]};data.update({r['modelPath']:r['sourceSHA256']for r in inv['candidates']})
# All installed algorithm dependency modules previously fingerprinted, including sb3-contrib.
deps=c.read(R/'work/pepe-finrl-dependencies.json');import importlib.metadata
packages={n:importlib.metadata.version(n)for n in ['FinRL','torch','stable-baselines3','sb3-contrib','gymnasium','numpy']}
import sb3_contrib
extra={}
for module in ['sb3_contrib.ppo_mask.ppo_mask','sb3_contrib.common.maskable.policies','sb3_contrib.common.maskable.buffers','sb3_contrib.common.maskable.distributions','sb3_contrib.common.maskable.utils','stable_baselines3.common.on_policy_algorithm','stable_baselines3.common.policies','stable_baselines3.common.buffers','stable_baselines3.common.save_util','stable_baselines3.ppo.ppo']:
 m=__import__(module,fromlist=['__file__']);f=Path(m.__file__).resolve();extra[str(f.relative_to(R))]=c.sha(f)
reg={'id':P['version'],'registeredAt':int(time.time()*1000),'protocol':P,'sourceHashes':{f:c.sha(R/f)for f in files},'dataHashes':data,'dependencyHashes':{**deps['sourceHashes'],**extra},'packageVersions':packages,'parentInventorySHA256':c.sha(B/'parent-inventory.json'),'selectionUsesTest':False,'finalTest':{'status':'locked_pending_new_prospective_period','oldFinalAlreadyConsumed':True},'realOrders':False}
c.immutable_json(B/'registration.json',reg);c.atomic(B/'control.json',{'desired':'paused','mode':'boost','updatedAt':int(time.time()*1000)})
print({'registered':P['version'],'candidates':inv['uniqueFiles'],'files':inv['nominalFiles'],'population':P['population'],'generations':P['generations']})
