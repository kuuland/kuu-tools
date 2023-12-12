#!/usr/bin/env bash
set -e

cd ../ && npm run pub

yarn publish --registry=https://registry.npmjs.org --non-interactive

if [ "$(uname)" == "Darwin" ]; then
    open https://npmmirror.com/sync/kuu-tools
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    xdg-open https://npmmirror.com/sync/kuu-tools
elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW32_NT" ]; then
    start https://npmmirror.com/sync/fano-antd
elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW64_NT" ]; then
    start https://npmmirror.com/sync/kuu-tools
fi
