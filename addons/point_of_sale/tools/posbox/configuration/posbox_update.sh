#!/usr/bin/env bash

cd /home/pi/odoo
localbranch=$(git symbolic-ref -q --short HEAD)
localremote=$(git config branch.$localbranch.remote)
git fetch "${localremote}" "${localbranch}" --depth=1
git reset "${localremote}"/"${localbranch}" --hard
(sleep 5 && sudo reboot) &
