"""Inference only on the user's preserved G151 forests. Never fits a model."""
import os
for key in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'):
    os.environ[key] = '1'
import hashlib, json, sys
from pathlib import Path
import joblib
import numpy as np
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / 'champions/g151-c6cb2a8370cd058b0be0'

def predict(request):
    manifest = json.loads((ARCHIVE / 'manifest.json').read_text())
    output = []
    with threadpool_limits(limits=1):
        for family in ('cross', 'bands'):
            rows = [r for r in request['rows'] if r['family'] == family]
            if not rows:
                continue
            x = np.asarray([r['x'] for r in rows], dtype=float)
            if x.shape != (len(rows), 12) or not np.isfinite(x).all():
                raise ValueError('Invalid G151 features')
            models = request['models'][family]
            if len(models) != 5:
                raise ValueError('G151 requires five preserved seeds per family')
            scores = []
            for item in models:
                file = (ARCHIVE / item['model']).resolve()
                if not file.is_relative_to((ARCHIVE / 'models').resolve()):
                    raise ValueError('Model outside preserved archive')
                actual = hashlib.sha256(file.read_bytes()).hexdigest()
                if actual != item['sha256'] or actual != manifest[item['model']]:
                    raise ValueError('Preserved model hash mismatch')
                model = joblib.load(file)
                if model.n_features_in_ != 12:
                    raise ValueError('Unexpected feature schema')
                for name, value in request['params'].items():
                    if model.get_params()[name] != value:
                        raise ValueError('Model is not G151')
                scores.append(model.predict_proba(x)[:, list(model.classes_).index(1)])
            average = np.mean(np.asarray(scores), axis=0)
            if not np.isfinite(average).all() or np.any((average < 0) | (average > 1)):
                raise ValueError('Invalid model scores')
            output.extend({'id': r['id'], 'family': family, 'score': float(v)} for r, v in zip(rows, average))
    return {'scores': output, 'training': False, 'modelsUsed': sum(5 for f in ('cross', 'bands') if any(r['family'] == f for r in request['rows']))}

if __name__ == '__main__':
    try:
        print(json.dumps(predict(json.load(sys.stdin)), allow_nan=False))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
