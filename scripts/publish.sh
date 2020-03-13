#!/usr/bin/env bash

cd ../ && npm run pub

yarn publish --non-interactive

for i in {1..3}
do
cnpm sync kuu-tools
done
