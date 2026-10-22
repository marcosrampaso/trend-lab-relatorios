"""Descriptive diagnostics only: never selects or modifies the genetic search."""
import statistics


def distribution(values):
    values = list(values)
    if not values:
        return {'count': 0, 'mean': None, 'median': None, 'minimum': None, 'maximum': None}
    return {'count': len(values), 'mean': statistics.mean(values),
            'median': statistics.median(values), 'minimum': min(values), 'maximum': max(values)}


def wallet_summary(wallets, fx):
    if not wallets:
        raise ValueError('Include all registered months, including zero-trade wallets')
    net = [w['pnlBRL'] for w in wallets]
    excess = [w['pnlBRL'] - w['cdi']['pnlBRL'] for w in wallets]
    trades = [t['net'] * fx for w in wallets for t in w['trades']]
    if sum(w['count'] for w in wallets) != len(trades):
        raise ValueError('Incomplete trade ledger')
    if abs(sum(trades) - sum(net)) > 1e-6:
        raise ValueError('Net positions must reconcile with wallets')
    positive = sorted((n for n in trades if n > 0), reverse=True)
    best_two = sum(positive[:2])
    return {'months': len(wallets), 'activeMonths': sum(w['count'] > 0 for w in wallets),
            'aboveCDI': sum(v > 0 for v in excess), 'monthlyNetBRL': distribution(net),
            'monthlyExcessBRL': distribution(excess), 'meanCDIBRL': statistics.mean(w['cdi']['pnlBRL'] for w in wallets),
            'positions': len(trades), 'perPositionBRL': distribution(trades),
            'winRate': sum(n > 0 for n in trades) / len(trades) if trades else None,
            'bestTwoPositiveBRL': best_two,
            'bestTwoShareOfPositivePNL': best_two / sum(positive) if positive else None,
            'sumNetWithoutBestTwoBRL': sum(net) - best_two,
            'meanMonthlyWithoutBestTwoBRL': (sum(net) - best_two) / len(wallets),
            'maximumMonthlyDrawdown': max(w['maxDD'] for w in wallets),
            'withoutBestTwoIsArithmeticDiagnosticNotReplay': True,
            'monthlyResetsAreNotCompounded': True}


def population_summary(population, candidates, identity):
    # Repeated genotypes retain their population weight; cash models stay included.
    records = [candidates[identity(p['genome'])] for p in population]
    return {'individuals': len(records), 'distinctGenomes': len({v['id'] for v in records}),
            'meanMonthlyNetBRL': distribution(v['meanMonthlyBRL'] for v in records),
            'fractionAboveCDIMean': sum(v['meanMonthlyBRL'] > v['meanCDIBRL'] for v in records) / len(records),
            'fractionWithSufficientSupport': sum(v['supportSufficient'] for v in records) / len(records),
            'zeroTradeIndividuals': sum(v['count'] == 0 for v in records)}


def continuation_gate(selection, audit):
    """Research budget gate, not an estimate of safety or a deployment approval."""
    checks = {
        'selectionSupport': selection['positions'] >= 30 and selection['activeMonths'] >= 3,
        'auditSupport': audit['positions'] >= 30 and audit['activeMonths'] >= 4,
        'auditMeanExceedsCDI': audit['monthlyExcessBRL']['mean'] > 0,
        'auditMedianExceedsCDI': audit['monthlyExcessBRL']['median'] > 0,
        'majorityAuditMonthsAboveCDI': audit['aboveCDI'] > audit['months'] / 2,
        'auditPositiveWithoutBestTwo': audit['sumNetWithoutBestTwoBRL'] > 0,
    }
    return {'eligibleForLargerResearchRun': all(checks.values()), 'checks': checks,
            'deploymentApproval': False, 'independentValidation': False}
