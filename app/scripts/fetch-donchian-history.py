"""Extend hourly ETH futures history with official checksums, without account keys."""
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
CACHE = ROOT / '.cache' / 'donchian-history'
HOUR = 3600000

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def get(url):
    return subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '45', url])

def load_month(job):
    kind, month = job
    suffix = 'fundingRate-' if kind == 'fundingRate' else '1h-'
    middle = f'{kind}/ETHUSDT/' + ('' if kind == 'fundingRate' else '1h/')
    name = f'ETHUSDT-{suffix}{month}.zip'
    url = f'https://data.binance.vision/data/futures/um/monthly/{middle}{name}'
    path = CACHE / (kind + '-' + name)
    check = path.with_suffix('.sha256')
    payload = path.read_bytes() if path.exists() else get(url)
    expected = check.read_text().strip() if check.exists() else get(url + '.CHECKSUM').decode().split()[0]
    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected:
        raise ValueError('Checksum divergente: ' + url)
    path.write_bytes(payload)
    check.write_text(expected)
    z = zipfile.ZipFile(io.BytesIO(payload))
    rows = list(csv.reader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig'))))
    # Older archives have no header. Never silently drop their first candle.
    if rows and not rows[0][0].isdigit():
        rows = rows[1:]
    if kind == 'fundingRate':
        parsed = [[int(r[0]), float(r[2])] for r in rows]
    else:
        count = 6 if kind == 'klines' else 5
        parsed = [[int(r[0]), *map(float, r[1:count])] for r in rows]
    return kind, parsed, {'url': url, 'sha256': actual, 'records': len(parsed)}

def main():
    protocol = json.loads((ROOT / 'donchian-history-protocol.json').read_text())
    freeze = json.loads((ROOT / 'donchian-history-freeze.json').read_text())
    if digest(ROOT / 'donchian-history-protocol.json') != freeze['protocolSHA256']:
        raise ValueError('Protocolo alterado')
    for file, expected in freeze['preservedFiles'].items():
        if digest(ROOT / file) != expected:
            raise ValueError('Arquivo preservado alterado: ' + file)
    target = ROOT / protocol['source']
    if freeze.get('dataSHA256'):
        if not target.exists() or digest(target) != freeze['dataSHA256']:
            raise ValueError('Histórico congelado divergente; não será sobrescrito')
        print('Histórico congelado íntegro; nenhum download necessário', flush=True)
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    months = [f'{y}-{m:02}' for y in range(2020, 2025) for m in range(1, 13)
              if f'{y}-{m:02}' < '2024-12']
    jobs = [(kind, month) for month in months for kind in ['klines', 'markPriceKlines', 'fundingRate']]
    values = {kind: [] for kind in ['klines', 'markPriceKlines', 'fundingRate']}
    sources = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending = [pool.submit(load_month, job) for job in jobs]
        for i, future in enumerate(as_completed(pending), 1):
            kind, rows, source = future.result()
            values[kind].extend(rows)
            sources.append(source)
            if i % 12 == 0 or i == len(jobs):
                print(f'{i}/{len(jobs)} arquivos oficiais verificados', flush=True)
    legacy_path = ROOT / protocol['dataPlan']['mergeSource']
    legacy = json.loads(legacy_path.read_text())
    for kind, key in [('klines', 'candles'), ('markPriceKlines', 'marks'), ('fundingRate', 'funding')]:
        values[kind].extend(legacy[key])
        values[kind].sort(key=lambda r: r[0])
        if len({r[0] for r in values[kind]}) != len(values[kind]):
            raise ValueError('Timestamp duplicado: ' + kind)
    candles, marks, funding = (values[k] for k in ['klines', 'markPriceKlines', 'fundingRate'])
    if any(b[0] - a[0] != HOUR for a, b in zip(candles, candles[1:])):
        raise ValueError('Lacuna nos candles; nenhum histórico foi publicado')
    missing = sorted(set(r[0] for r in candles) - set(r[0] for r in marks))
    repairs = []
    while missing:
        start = missing[0]
        wanted = {t for t in missing if t < start + 1500 * HOUR}
        url = f'https://fapi.binance.com/fapi/v1/markPriceKlines?symbol=ETHUSDT&interval=1h&startTime={start}&endTime={max(wanted)+HOUR-1}&limit=1500'
        raw = get(url)
        rows = [[int(r[0]), *map(float, r[1:5])] for r in json.loads(raw) if int(r[0]) in wanted]
        if {r[0] for r in rows} != wanted:
            raise ValueError('Mark prices não recuperados naAPI oficial')
        marks.extend(rows)
        repairs.append({'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'records': len(rows), 'note': 'API oficial, sem checksum externo'})
        missing = [t for t in missing if t not in wanted]
    marks.sort(key=lambda r: r[0])
    if [r[0] for r in candles] != [r[0] for r in marks]:
        raise ValueError('Mark prices e candles desalinhados')
    for rows in [candles, marks]:
        if any(not (r[0] % HOUR == 0 and r[3] > 0 and r[3] <= min(r[1], r[4]) <= max(r[1], r[4]) <= r[2]) for r in rows):
            raise ValueError('OHLC inválido')
    start_test = int(datetime.fromisoformat(protocol['dataPlan']['firstTestStart'].replace('Z', '+00:00')).timestamp()*1000)
    end_download = int(datetime.fromisoformat(protocol['dataPlan']['downloadEnd'].replace('Z', '+00:00')).timestamp()*1000)
    checked = [r for r in funding if start_test <= r[0] < end_download]
    if not checked or checked[0][0] - start_test > 8*HOUR or end_download - checked[-1][0] > 8*HOUR + 60000:
        raise ValueError('Funding ausente na borda do período')
    if any(b[0] - a[0] > 8*HOUR + 60000 for a, b in zip(checked, checked[1:])):
        raise ValueError('Lacuna de funding; nenhum histórico foi publicado')
    result = {'symbol': 'ETHUSDT', 'venue': legacy['venue'], 'interval': '1h',
        'retrievedAt': datetime.now(timezone.utc).isoformat(), 'protocolSHA256': freeze['protocolSHA256'],
        'candles': candles, 'marks': marks, 'funding': funding,
        'sources': sorted(sources, key=lambda s: s['url']), 'repairs': repairs,
        'legacy': {'file': protocol['dataPlan']['mergeSource'], 'sha256': digest(legacy_path),
                   'sources': legacy.get('sources', []), 'repairs': legacy.get('repairs', [])},
        'filters': legacy['filters'], 'filtersAsOf': legacy['filtersAsOf'],
        'notes': ['Sem interpolação. Janeiro2020 reservado ao aquecimento.',
                  'Filtros e câmbio retroativos; não é treino de machine learning.',
                  'Quatro blocos antigos usam arquivo original, mantendo o mesmo aquecimento e resultados.']}
    target.write_text(json.dumps(result, separators=(',', ':')))
    print(json.dumps({'file': str(target), 'candles': len(candles), 'funding': len(funding),
        'from': datetime.fromtimestamp(candles[0][0]/1000, timezone.utc).isoformat(),
        'until': datetime.fromtimestamp((candles[-1][0]+HOUR)/1000, timezone.utc).isoformat(),
        'archives': len(sources), 'repairs': len(repairs)}), flush=True)

if __name__ == '__main__':
    main()
