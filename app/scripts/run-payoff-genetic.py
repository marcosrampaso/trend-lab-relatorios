import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS','LOKY_MAX_CPU_COUNT']:os.environ[k]='1'
import json,time,sys,signal,shutil,subprocess,re,statistics,threading,concurrent.futures,multiprocessing
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from payoff_genetic_core import founder,identity,initial_population,evolve,score
from payoff_genetic_worker import ROOT,BASE,read,sha,atomic,immutable,initialize,evaluate_genome

P=read(BASE/'protocol.json');REG=read(BASE/'registration.json');PUBLIC=ROOT/'web/data/payoff-genetic.json';STOP=False;RPC=None
def verify(all_inputs=False):
    if sha(BASE/'protocol.json')!=REG['protocolSHA256']:raise ValueError('Protocol changed')
    for f,h in {**(REG['inputs']if all_inputs else {}),**REG['sourceHashes']}.items():
        if sha(ROOT/f)!=h:raise ValueError('Frozen input changed '+f)
def memory_mib():
    try:
        s=subprocess.check_output(['vm_stat'],text=True);page=int(re.search(r'page size of (\d+)',s)[1]);return sum(int(re.search(k+r':\s+(\d+)',s)[1])for k in ['Pages free','Pages inactive','Pages speculative'])*page/1024**2
    except Exception:return 2048
def wallet_rpc(request):
    RPC.stdin.write(json.dumps(request,separators=(',',':'))+'\n');RPC.stdin.flush();line=RPC.stdout.readline()
    if not line:raise RuntimeError('Wallet subprocess exited')
    value=json.loads(line)
    if not value.get('ok'):raise RuntimeError(value.get('error','Wallet failure'))
    return value['result']
def compact(w):return {k:w[k]for k in ['month','pnlBRL','count','maxDD','sourceEntryCount','overlapSkips','riskSkips']}|{'cdi':{'pnlBRL':w['cdi']['pnlBRL']}}
def candidate(fit):
    file=BASE/'candidates'/f"{fit['id']}.json"
    if file.exists():return read(file)
    wallets=wallet_rpc({'folds':fit['folds']});value={'id':fit['id'],'genome':fit['genome'],**score(wallets,fit['genome']),'wallets':[compact(w)for w in wallets],'maturity':[{'month':f['month'],'maturity':f['maturity']}for f in fit['folds']],'fitSeconds':fit['fitSeconds']}
    immutable(file,value);return value
def archive(value,generation):
    folder=BASE/'champions'/f"g{generation:03d}-{value['id']}-{time.time_ns()}"
    # Fresh refit must reproduce the exact selected phenotype before freezing it.
    initialize();fit=evaluate_genome(value['genome'],str(folder));wallets=wallet_rpc({'folds':fit['folds']});actual=score(wallets,value['genome'])
    if abs(actual['fitness']-value['fitness'])>1e-8:raise ValueError('Champion archive did not reproduce selection')
    immutable(folder/'wallets.json',wallets);immutable(folder/'candidate.json',value)
    hashes={str(f.relative_to(ROOT)):sha(f)for f in folder.iterdir()if f.is_file()};record={'generation':generation,'id':value['id'],'archivedAt':int(time.time()*1000),'artifacts':hashes,'wallets':wallets,'candidate':value}
    immutable(folder/'complete.json',record);return {'path':str((folder/'complete.json').relative_to(ROOT)),'sha256':sha(folder/'complete.json'),'generation':generation,**value,'wallets':wallets}
def status(state,phase,**extra):
    v={'app':'trend-lab-payoff-genetic','pid':os.getpid(),'phase':phase,'updatedAt':int(time.time()*1000),'protocol':P,'completedGenerations':state.get('completedGenerations',0),'generation':state.get('completedGenerations',0),'targetGenerations':P['generations'],'population':256,'completedMembers':state.get('completedMembers',0),'history':state.get('history',[]),'best':state.get('best'),'baseline':state.get('baseline'),'cashFitness':state.get('cashFitness'),'activeSeconds':state.get('activeSeconds',0),'actualModelWorkers':extra.pop('workers',0),'maximumModelWorkers':9,'walletWorkers':1,'maxWallHours':None,'train':True,'realOrders':False,'independentValidation':False,'automaticPromotion':False,**extra}
    atomic(BASE/'status.json',v);atomic(PUBLIC,v)
def desired():return read(BASE/'control.json')['desired']
def checkpoint(state):atomic(BASE/'checkpoint.json',state)
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def response(self,code,value):
        raw=json.dumps(value).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store')
        origin=self.headers.get('Origin')
        if origin in ['http://127.0.0.1:4173','http://localhost:4173']:
            self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin');self.send_header('Access-Control-Allow-Headers','Content-Type,X-Trend-Payoff');self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS');self.send_header('Access-Control-Allow-Private-Network','true')
        self.end_headers();self.wfile.write(raw)
    def allowed(self):return self.path=='/api/payoff-genetic' and self.headers.get('Host')in['127.0.0.1:4180','localhost:4180']
    def do_GET(self):self.response(200,read(BASE/'status.json'))if self.allowed()else self.response(403,{'error':'Local endpoint required'})
    def do_OPTIONS(self):self.response(204,{})if self.allowed()and self.headers.get('Origin')in['http://127.0.0.1:4173','http://localhost:4173']else self.response(403,{})
    def do_POST(self):
        if not self.allowed()or self.headers.get('Origin')not in['http://127.0.0.1:4173','http://localhost:4173']or self.headers.get('X-Trend-Payoff')!='payoff-genetic-v1'or not self.headers.get('Content-Type','').startswith('application/json'):return self.response(403,{'error':'Same-origin local control required'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=256:raise ValueError('Invalid body size')
            value=json.loads(self.rfile.read(size));action=value.get('action')
            if set(value)!={'action'}or action not in ['pause','resume']:raise ValueError('Unknown control')
            if (BASE/'checkpoint.json').exists()and read(BASE/'checkpoint.json').get('completedGenerations',0)>=100:raise ValueError('Run completed; cannot restart it')
            atomic(BASE/'control.json',{'desired':'paused'if action=='pause'else'running','updatedAt':int(time.time()*1000)});self.response(200,{'accepted':True,'action':action})
        except Exception as e:self.response(400,{'error':str(e)})
def stop(*args):
    global STOP
    STOP=True;atomic(BASE/'control.json',{'desired':'paused','updatedAt':int(time.time()*1000)})
def run():
    global RPC
    verify(True);RPC=subprocess.Popen(['node','scripts/payoff-genetic-wallet.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
    server=None;state={}
    try:
        parity=wallet_rpc({'parity':True});immutable(BASE/f'parity-{time.time_ns()}.json',parity)
        if '--benchmark' in sys.argv:
            start=time.monotonic();initialize();v=candidate(evaluate_genome(founder()));atomic(BASE/'benchmark.json',{'seconds':time.monotonic()-start,'candidate':v,'parity':parity});print(json.dumps(read(BASE/'benchmark.json')));return
        server=ThreadingHTTPServer(('127.0.0.1',4180),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
        if not (BASE/'control.json').exists():atomic(BASE/'control.json',{'desired':'running'})
        state=read(BASE/'checkpoint.json')if(BASE/'checkpoint.json').exists()else{'completedGenerations':0,'completedMembers':0,'population':initial_population(P['seed']),'history':[],'activeSeconds':0,'stagnation':0,'best':None}
        signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
        status(state,'initializing');initialize()
        if not state.get('baseline'):
            v=candidate(evaluate_genome(founder()));state['baseline']=archive(v,0);state['best']=state['baseline'];cash=[{**w,'pnlBRL':0,'maxDD':0,'count':0}for w in v['wallets']];state['cashFitness']=score(cash,founder())['fitness']+.019;checkpoint(state)
        while state['completedGenerations']<P['generations']and not STOP:
            verify();low_disk=shutil.disk_usage(BASE).free<3*1024**3;low_ram=memory_mib()<750
            if desired()!='running'or low_disk or low_ram:
                phase='paused_disk'if low_disk else'paused_memory'if low_ram else'paused';status(state,phase)
                if low_disk or low_ram:atomic(BASE/'control.json',{'desired':'paused','reason':phase})
                while not STOP and desired()!='running':time.sleep(2)
                continue
            started=time.monotonic();population=state['population'];unique={identity(p['genome']):p['genome']for p in population};records={};jobs=[]
            for key,g in unique.items():
                file=BASE/'candidates'/f'{key}.json'
                if file.exists():records[key]=read(file)
                else:jobs.append(g)
            workers=min(9,max(1,int((memory_mib()-512)/160)));state['completedMembers']=sum(identity(p['genome'])in records for p in population);status(state,'training',workers=workers,uniquePopulation=len(unique))
            with concurrent.futures.ProcessPoolExecutor(max_workers=workers,mp_context=multiprocessing.get_context('spawn'),initializer=initialize)as pool:
                pending={};index=0
                while pending or index<len(jobs):
                    while not STOP and desired()=='running'and len(pending)<workers and index<len(jobs):
                        g=jobs[index];index+=1;pending[pool.submit(evaluate_genome,g)]=identity(g)
                    if not pending:break
                    done,_=concurrent.futures.wait(pending,timeout=2,return_when=concurrent.futures.FIRST_COMPLETED)
                    for future in done:
                        key=pending.pop(future);records[key]=candidate(future.result());state['completedMembers']=sum(identity(p['genome'])in records for p in population);state['activeSeconds']+=time.monotonic()-started;started=time.monotonic();checkpoint(state);status(state,'pausing'if STOP or desired()!='running'else'training',workers=len(pending),uniquePopulation=len(unique))
                # No queued work is abandoned: only currently active fits drain on pause.
            state['activeSeconds']+=time.monotonic()-started;checkpoint(state)
            if len(records)!=len(unique):continue
            ranked=sorted(records.values(),key=lambda v:(-v['fitness'],v['id']));best=ranked[0];improved=best['fitness']>state['best']['fitness']+1e-9
            if improved:state['best']=archive(best,state['completedGenerations']);state['stagnation']=0
            else:state['stagnation']+=1
            values=[records[identity(p['genome'])]['fitness']for p in population];state['history'].append({'generation':state['completedGenerations'],'bestFitness':state['best']['fitness'],'generationBestFitness':best['fitness'],'medianFitness':statistics.median(values),'bestMeanMonthlyBRL':state['best']['meanMonthlyBRL'],'bestTrades':state['best']['count'],'unique':len(unique),'improved':improved,'stagnation':state['stagnation']})
            state['completedGenerations']+=1;state['completedMembers']=0
            if state['completedGenerations']<100:state['population'],state['operators']=evolve(population,records,P['seed'],state['completedGenerations'],state['stagnation'])
            checkpoint(state);status(state,'training',workers=0)
        if state.get('completedGenerations')==100 and not STOP:
            status(state,'auditing');verify(True)
            from importlib import import_module
            # File has a CLI-style name; importlib can load the exact registered module.
            audit=import_module('audit-payoff-genetic').audit(state['best']['genome'],wallet_rpc)
            verify(True);state['audit']=audit;checkpoint(state);status(state,'complete',audit=audit)
        else:status(state,'paused')
    except Exception as e:
        status(state,'error',error=str(e));raise
    finally:
        if RPC:RPC.stdin.close();RPC.wait(timeout=30)
        if server:server.shutdown();server.server_close()
if __name__=='__main__':run()
