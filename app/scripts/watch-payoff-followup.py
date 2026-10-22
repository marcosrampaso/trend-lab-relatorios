"""Independent local report queue. Reads frozen results, never controls training."""
import argparse
import hashlib
import json
import os
import signal
import time
from pathlib import Path
from payoff_genetic_core import identity, initial_population, evolve
from payoff_followup_core import population_summary, wallet_summary, continuation_gate

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'work/pepe-payoff-genetic-v1'
BASE = ROOT / 'work/pepe-payoff-followup-v1'
PUBLIC = ROOT / 'web/data/payoff-followup.json'
STOP = False


def read(p):
    return json.loads(Path(p).read_text())


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def atomic(p, value):
    p = Path(p)
    temp = p.with_name(p.name + f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')))
    temp.replace(p)


def immutable(p, value):
    with Path(p).open('x') as f:
        json.dump(value, f, ensure_ascii=False, allow_nan=False)
    Path(p).chmod(0o444)


def collect():
    p = read(SOURCE / 'protocol.json')
    state = read(SOURCE / 'checkpoint.json')
    protocol = read(BASE / 'protocol.json')
    if sha(SOURCE / 'protocol.json') != protocol['sourceProtocolSHA256']:
        raise ValueError('Source protocol changed')
    population = initial_population(p['seed'])
    rows = []
    for h in state['history']:
        g = h['generation']
        saved = BASE / 'generations' / f'g{g:03d}.json'
        keys = {identity(i['genome']) for i in population}
        candidates = {key: read(SOURCE / 'candidates' / f'{key}.json') for key in keys}
        if saved.exists():
            result = read(saved)
        else:
            result = {'generation': g, **population_summary(population, candidates, identity),
                      'candidateHashes': {key: sha(SOURCE / 'candidates' / f'{key}.json') for key in keys},
                      'bestMeanMonthlyBRL': h['bestMeanMonthlyBRL'], 'selectionOnly': True}
            immutable(saved, result)
        rows.append({k: v for k, v in result.items() if k != 'candidateHashes'})
        if g < p['generations'] - 1:
            population, _ = evolve(population, candidates, p['seed'], g + 1, h['stagnation'])
    if population != state['population']:
        raise ValueError('Reconstructed population does not match running checkpoint')
    best = state['best']
    selection = wallet_summary(best['wallets'], p['engine']['fx'])
    old = read(ROOT / 'work/pepe-g830-audit-v1/result.json')
    value = {'version': 'payoff-followup-v1', 'updatedAt': int(time.time() * 1000),
             'phase': 'waiting_for_100', 'completedGenerations': state['completedGenerations'],
             'history': rows, 'selection': selection, 'championID': best['id'],
             'selectionMonthly': [{'month': w['month'], 'pnlBRL': w['pnlBRL'], 'positions': w['count'], 'cdiBRL': w['cdi']['pnlBRL']} for w in best['wallets']],
             'oldG830': {'probeBRL': old['replayedProbe']['pnlBRL'],
                         'probePositions': old['replayedProbe']['count'],
                         'quarterBRL': old['fullQuarter']['pnlBRL'],
                         'quarterPositions': old['fullQuarter']['count'],
                         'sameProtocolComparison': False, 'exactHistoricalWeightsRecovered': False},
             'queue': protocol['queue'], 'realOrders': False, 'trainingUntouched': True,
             'independentValidation': False}
    if state.get('audit'):
        audit = state['audit']
        value['audit'] = wallet_summary(audit['wallets'], p['engine']['fx'])
        value['auditMonthly'] = [{'month': w['month'], 'pnlBRL': w['pnlBRL'], 'positions': w['count'], 'cdiBRL': w['cdi']['pnlBRL']} for w in audit['wallets']]
        original = read(ROOT / 'work/pepe-payoff-entry-v1/result.json')['results']['payoff_boost-combined']['wallets']
        if [w['month'] for w in original] != [w['month'] for w in audit['wallets']]:
            raise ValueError('Baseline and audit months differ')
        value['originalBoostingAudit'] = wallet_summary(original, p['engine']['fx'])
        value['gate'] = continuation_gate(selection, value['audit'])
        value['phase'] = 'audit_report_complete'
        result = BASE / 'final-report.json'
        if not result.exists():
            value['sourceAuditSHA256'] = sha(SOURCE / 'final-audit/result.json')
            immutable(result, value)
        else:
            value = read(result)
    atomic(BASE / 'status.json', value)
    atomic(PUBLIC, value)
    return value


def stop(*_):
    global STOP
    STOP = True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    registration = read(BASE / 'registration.json')
    for f, expected in registration['sourceHashes'].items():
        if sha(ROOT / f) != expected:
            raise ValueError('Registered follow-up source changed: ' + f)
    if sha(BASE / 'protocol.json') != registration['protocolSHA256']:
        raise ValueError('Follow-up protocol changed')
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    last = None
    while not STOP:
        try:
            checkpoint = read(SOURCE / 'checkpoint.json')
            marker = (checkpoint['completedGenerations'], checkpoint.get('best', {}).get('id'), bool(checkpoint.get('audit')))
            if marker != last or args.once:
                state = collect()
                last = marker
            if args.once or state['phase'] == 'audit_report_complete':
                print(json.dumps({'phase': state['phase'], 'generations': state['completedGenerations']}), flush=True)
                break
        except Exception as e:
            atomic(BASE / 'error.json', {'at': int(time.time() * 1000), 'error': str(e)})
            previous = read(BASE / 'status.json') if (BASE / 'status.json').exists() else {}
            atomic(PUBLIC, {**previous, 'phase': 'error', 'error': str(e), 'updatedAt': int(time.time() * 1000)})
            if args.once:
                raise
        for _ in range(30):
            if STOP:
                break
            time.sleep(1)
