import{v4Action,v4Status}from'./pepe-v4-service.mjs';
const action=process.argv[2]??'status',s=action==='status'?v4Status():v4Action(action,process.argv[3]);
console.log(JSON.stringify({active:s.active,pid:s.pid,control:s.control,status:s.report.status,phase:s.report.phase,generation:s.report.generation,jobs:s.report.jobsCompleted,error:s.report.error}));
