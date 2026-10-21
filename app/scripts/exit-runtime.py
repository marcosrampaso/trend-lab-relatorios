"""Operational capacity only. No model, data, reward or training budget changes."""
import time,subprocess,re
def capacity(control,now=None,memory=None):
 now=time.time()*1000 if now is None else now
 requested=control.get('mode','boost')
 if requested not in ['eco','boost','ultra']:raise ValueError('Unknown capacity mode')
 authorized=requested=='ultra'and isinstance(control.get('ultraRequestedAt'),(int,float))and control.get('ultraExpiresAt',0)>now
 mode='ultra'if authorized else'eco'if requested=='ultra'else requested
 workers={'eco':1,'boost':3,'ultra':5}[mode]
 if memory is not None:workers=min(workers,0 if memory<12 else 1 if memory<20 else workers)
 return{'effectiveMode':mode,'requestedMode':requested,'workers':workers,'threadsPerWorker':2,'maximumWorkers':5,'ultraExpiresAt':control.get('ultraExpiresAt'),'ultraExpired':requested=='ultra'and not authorized,'memoryAvailablePercent':memory,'memoryLimited':workers<{'eco':1,'boost':3,'ultra':5}[mode],'scientificProtocolChanged':False}
def memory_percent():
 try:
  r=subprocess.run(['/usr/bin/memory_pressure','-Q'],capture_output=True,text=True,timeout=3);m=re.search(r'System-wide memory free percentage:\s*(\d+)',r.stdout)
  return int(m.group(1))if r.returncode==0 and m else None
 except(OSError,subprocess.TimeoutExpired):return None
