import {test}from'node:test';import {execFileSync}from'node:child_process';
test('risk pipeline preserves chronological labels, paired directions, protected flags and frozen calibration',()=>{execFileSync('.venv-rl/bin/python',['tests/test_pepe_risk_selection.py'],{env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'},stdio:'pipe'});});
