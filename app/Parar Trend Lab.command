#!/bin/zsh
cd -- "${0:A:h}"
local_node="$(command -v node)"
if [[ -z "$local_node" ]] || ! "$local_node" --input-type=module -e 'await import("node:sqlite")' >/dev/null 2>&1; then local_node="/opt/homebrew/opt/node/bin/node"; fi
if [[ ! -x "$local_node" ]]; then local_node="/opt/homebrew/Cellar/node/26.7.0/bin/node"; fi
"$local_node" scripts/local-service.mjs stop
