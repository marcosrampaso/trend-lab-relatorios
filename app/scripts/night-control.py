"""Local-only operational API. Scientific parameters cannot be changed here."""
import importlib,json,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
c=importlib.import_module('night-core');B,R=c.BASE,c.ROOT
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def reply(self,code,value):
  raw=json.dumps(value,allow_nan=False).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');origin=self.headers.get('Origin')
  if origin in ['http://127.0.0.1:4173','http://localhost:4173']:
   self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin');self.send_header('Access-Control-Allow-Headers','Content-Type,X-Trend-Night');self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  self.end_headers();self.wfile.write(raw)
 def valid(self):return self.path=='/api/night'and self.headers.get('Host')in['127.0.0.1:4183','localhost:4183']
 def do_GET(self):
  if not self.valid():return self.reply(403,{})
  result=c.read(B/'status.json')if(B/'status.json').exists()else{'phase':'queued'};result['control']=c.read(B/'control.json');self.reply(200,result)
 def do_OPTIONS(self):self.reply(204,{})if self.valid()and self.headers.get('Origin')in['http://127.0.0.1:4173','http://localhost:4173']else self.reply(403,{})
 def do_POST(self):
  if not self.valid()or self.headers.get('Origin')not in['http://127.0.0.1:4173','http://localhost:4173']or self.headers.get('X-Trend-Night')!='night-v1'or not self.headers.get('Content-Type','').startswith('application/json'):return self.reply(403,{'error':'Local origin required'})
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=128:raise ValueError('Body size')
   v=json.loads(self.rfile.read(size))
   if set(v)!={'action'}or v['action']not in['pause','resume','eco','ultra']:raise ValueError('Only operational controls allowed')
   old=c.read(B/'control.json');a=v['action'];new={**old,'updatedAt':int(time.time()*1000)}
   if a in['pause','resume']:new['desired']='paused'if a=='pause'else'running'
   else:new['mode']=a
   c.atomic(B/'control.json',new)
   # Pause/resume the active genotype stage as well. No scientific field is writable.
   status=c.read(B/'status.json')if(B/'status.json').exists()else{}
   folder=c.ROOT/('work/pepe-payoff-genetic-v1'if status.get('phase')=='waiting_100'else'work/pepe-payoff-genetic-200-v1')
   if a in['pause','resume']and status.get('phase')in['waiting_100','genetic_200']:c.atomic(folder/'control.json',{'desired':new['desired'],'updatedAt':new['updatedAt']})
   self.reply(200,{'accepted':True,'control':new})
  except Exception as e:self.reply(400,{'error':str(e)})
def serve():return ThreadingHTTPServer(('127.0.0.1',4183),Handler)
