import{exitStatus,exitAction}from'./exit-lab-service.mjs';console.log(JSON.stringify(process.argv[2]==='status'?exitStatus():exitAction(process.argv[2]??'resume')));
