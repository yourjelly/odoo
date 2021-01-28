#!/usr/bin/env bash

google-chrome-stable \
    --headless \
    --disable-web-security \
    --no-default-browser-check \
    --no-first-run \
    --disable-extensions \
    --disable-background-networking \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-breakpad \
    --disable-client-side-phishing-detection \
    --disable-crash-reporter \
    --disable-default-apps \
    --disable-dev-shm-usage \
    --disable-device-discovery-notifications \
    --disable-namespace-sandbox \
    --disable-translate \
    --window-size=$1 \
    --remote-debugging-address=$2 \
    --remote-debugging-port=$3 \
    --user-data-dir=$4 \
    --disable-gpu \
    about:blank
