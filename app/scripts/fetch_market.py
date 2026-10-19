import csv, hashlib, io, json, subprocess, zipfile
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parent.parent
out = root / 'web'
cache = root / '.cache' / 'market'
cache.mkdir(parents=True, exist_ok=True)

def get(url):
    return subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '40', url])

sources = []
def archive(kind, month):
    middle = f'{kind}/ETHUSDT/' + ('1h/' if kind != 'fundingRate' else '')
    filename = f'ETHUSDT-' + ('1h-' if kind != 'fundingRate' else 'fundingRate-') + month + '.zip'
    url = 'https://data.binance.vision/data/futures/um/monthly/' + middle + filename
    path = cache / (kind + '-' + filename)
    content = path.read_bytes() if path.exists() else get(url)
    expected = get(url + '.CHECKSUM').decode().split()[0]
    actual = hashlib.sha256(content).hexdigest()
    if expected != actual:
        raise ValueError('Checksum mismatch: ' + url)
    path.write_bytes(content)
    z = zipfile.ZipFile(io.BytesIO(content))
    text = z.read(z.namelist()[0]).decode('utf-8-sig')
    sources.append({'url': url, 'sha256': actual})
    return list(csv.DictReader(io.StringIO(text)))

candles, marks, funding = [], [], []
for month in ['2025-01','2025-02','2025-03','2025-04','2025-05']:
    prices = archive('klines', month)
    markrows = archive('markPriceKlines', month)
    fundrows = archive('fundingRate', month)
    print(month, 'headers', list(prices[0]), list(markrows[0]), list(fundrows[0]), flush=True)
    for r in prices:
        candles.append([int(r['open_time']), *[float(r[k]) for k in ['open','high','low','close','volume']]])
    for r in markrows:
        marks.append([int(r['open_time']), *[float(r[k]) for k in ['open','high','low','close']]])
    for r in fundrows:
        funding.append([int(r['calc_time']), float(r['last_funding_rate'])])
    print(month, len(prices), len(markrows), len(fundrows), flush=True)

for rows in [candles, marks]:
    if any(b[0]-a[0] != 3600000 for a,b in zip(rows,rows[1:])):
        raise ValueError('Missing/duplicate hourly data')
if [r[0] for r in candles] != [r[0] for r in marks]:
    raise ValueError('Mark/trade time mismatch')

exchange = json.loads(get('https://fapi.binance.com/fapi/v1/exchangeInfo'))
symbol = next(s for s in exchange['symbols'] if s['symbol']=='ETHUSDT')
dataset = {'symbol':'ETHUSDT','venue':'Binance USDⓈ-M Futures','interval':'1h',
 'retrievedAt':datetime.now(timezone.utc).isoformat(), 'candles':candles,'marks':marks,'funding':funding,
 'sources':sources,'filters':symbol['filters'],'filtersAsOf':datetime.now(timezone.utc).isoformat(),
 'notes':['Candles e funding históricos reais; filtros atuais aplicados retroativamente.',
          '2025-01 a 2025-03: aquecimento/desenvolvimento. Abril: validação. Maio: teste temporal.',
          'Nenhum modelo de machine learning treinado; EMA16/64 e ATR14 com regras fixas.']}
(out/'data'/'eth-2025.json').write_text(json.dumps(dataset,separators=(',',':')))
(out/'vendor').mkdir(exist_ok=True)
for name,url in [
 ('lightweight-charts.js','https://unpkg.com/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js'),
 ('LICENSE.txt','https://raw.githubusercontent.com/tradingview/lightweight-charts/v5.0.8/LICENSE'),
 ('NOTICE.txt','https://raw.githubusercontent.com/tradingview/lightweight-charts/v5.0.8/NOTICE')]:
    (out/'vendor'/name).write_bytes(get(url))
print('DONE',len(candles),'candles',len(funding),'funding events',len(json.dumps(dataset)),'bytes')
