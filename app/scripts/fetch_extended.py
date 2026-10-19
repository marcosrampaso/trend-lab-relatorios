"""Baixa dados públicos e verifica checksums, sem credenciais da conta."""
import csv
import hashlib
import io
import json
import subprocess
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROTOCOL = ROOT / 'research-protocol.json'
CACHE = ROOT / '.cache' / 'extended'
CACHE.mkdir(parents=True, exist_ok=True)

def get(url):
    return subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '50', url])

def load_month(job):
    kind, month = job
    infix = '1h-' if kind != 'fundingRate' else 'fundingRate-'
    filename = f'ETHUSDT-{infix}{month}.zip'
    middle = f'{kind}/ETHUSDT/' + ('1h/' if kind != 'fundingRate' else '')
    url = 'https://data.binance.vision/data/futures/um/monthly/' + middle + filename
    path = CACHE / (kind + '-' + filename)
    checksum_path = path.with_suffix('.sha256')
    payload = path.read_bytes() if path.exists() else get(url)
    checksum = checksum_path.read_text().strip() if checksum_path.exists() else get(url + '.CHECKSUM').decode().split()[0]
    actual = hashlib.sha256(payload).hexdigest()
    if checksum != actual:
        raise ValueError('Checksum mismatch: ' + url)
    path.write_bytes(payload)
    checksum_path.write_text(checksum)
    z = zipfile.ZipFile(io.BytesIO(payload))
    rows = list(csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig'))))
    if kind == 'fundingRate':
        records = [[int(r['calc_time']), float(r['last_funding_rate'])] for r in rows]
    else:
        keys = ['open', 'high', 'low', 'close'] + (['volume'] if kind == 'klines' else [])
        records = [[int(r['open_time']), *[float(r[k]) for k in keys]] for r in rows]
    return kind, month, records, {'url': url, 'sha256': actual}

if __name__ == '__main__':
    protocol_hash = hashlib.sha256(PROTOCOL.read_bytes()).hexdigest()
    freeze = ROOT / 'research-freeze.json'
    if freeze.exists():
        record = json.loads(freeze.read_text())
        if record['protocolSHA256'] != protocol_hash:
            raise ValueError('O protocolo mudou após o congelamento. Crie outra versão de pesquisa.')
    else:
        freeze.write_text(json.dumps({'frozenAt': datetime.now(timezone.utc).isoformat(), 'protocolSHA256': protocol_hash, 'note': 'Protocolo congelado antes de baixar os novos dados; não é registro externo independente.'}, indent=2))
    months = ['2024-12'] + [f'{y}-{m:02}' for y, last in [(2025, 12), (2026, 9)] for m in range(1, last + 1)]
    jobs = [(kind, month) for month in months for kind in ['klines', 'markPriceKlines', 'fundingRate']]
    datasets = {'klines': [], 'markPriceKlines': [], 'fundingRate': []}
    sources = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(load_month, job) for job in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            kind, month, rows, source = future.result()
            datasets[kind].extend(rows)
            sources.append(source)
            if i % 6 == 0 or i == len(jobs):
                print(f'{i}/{len(jobs)} arquivos verificados', flush=True)
    for rows in datasets.values():
        rows.sort(key=lambda r: r[0])
    rows = datasets['klines']
    if any(b[0] - a[0] != 3600000 for a, b in zip(rows, rows[1:])):
        raise ValueError('Dados horários descontínuos: klines')
    known = {r[0] for r in datasets['markPriceKlines']}
    missing = [r[0] for r in datasets['klines'] if r[0] not in known]
    repairs = []
    if missing:
        # Nunca preencher mark price com preço negociado ou interpolação.
        import urllib.parse
        query = urllib.parse.urlencode({'symbol': 'ETHUSDT', 'interval': '1h', 'startTime': min(missing), 'endTime': max(missing) + 3599999, 'limit': 1500})
        url = 'https://fapi.binance.com/fapi/v1/markPriceKlines?' + query
        payload = get(url)
        parsed = json.loads(payload)
        restored = [[int(r[0]), *[float(x) for x in r[1:5]]] for r in parsed if int(r[0]) in missing]
        if len({r[0] for r in restored}) != len(missing):
            raise ValueError('A API oficial não recuperou todos os mark prices ausentes')
        datasets['markPriceKlines'].extend(restored)
        datasets['markPriceKlines'].sort(key=lambda r: r[0])
        repairs.append({'missingHours': len(missing), 'source': url, 'sha256': hashlib.sha256(payload).hexdigest(), 'note': 'REST oficial; hash da resposta registrada, sem checksum externo publicado.'})
        print(f'{len(missing)} mark prices recuperados na API oficial', flush=True)
    if [r[0] for r in datasets['klines']] != [r[0] for r in datasets['markPriceKlines']]:
        raise ValueError('Candles e mark prices desalinhados')
    exchange = json.loads(get('https://fapi.binance.com/fapi/v1/exchangeInfo'))
    symbol = next(s for s in exchange['symbols'] if s['symbol'] == 'ETHUSDT')
    result = {'symbol': 'ETHUSDT', 'venue': 'Binance USDⓈ-M Futures', 'interval': '1h',
              'retrievedAt': datetime.now(timezone.utc).isoformat(), 'protocolSHA256': protocol_hash,
              'candles': datasets['klines'], 'marks': datasets['markPriceKlines'], 'funding': datasets['fundingRate'],
              'sources': sorted(sources, key=lambda s: s['url']), 'repairs': repairs, 'filters': symbol['filters'],
              'filtersAsOf': datetime.now(timezone.utc).isoformat(),
              'notes': ['Dados históricos reais, filtros atuais retroativos.', 'Custos e manutenção conforme protocolo fixado; sem treino de machine learning.']}
    target = ROOT / 'web' / 'data' / 'eth-extended.json'
    target.write_text(json.dumps(result, separators=(',', ':')))
    print(json.dumps({'path': str(target), 'candles': len(result['candles']), 'funding': len(result['funding']), 'sources': len(sources), 'protocolSHA256': protocol_hash}), flush=True)
