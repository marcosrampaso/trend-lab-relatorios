#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 -m venv .venv-ml
if [ -f requirements-local-ml.lock.txt ]; then
  .venv-ml/bin/python -m pip install --only-binary=:all: -r requirements-local-ml.lock.txt
else
  .venv-ml/bin/python -m pip install --only-binary=:all: -r requirements-local-ml.txt
  .venv-ml/bin/python -m pip freeze > requirements-local-ml.lock.txt
fi
echo 'Ambiente local preparado. Execute npm run ml:train -- --profile overnight --workers 10'
