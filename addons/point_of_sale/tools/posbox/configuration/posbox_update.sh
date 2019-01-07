#!/usr/bin/env bash

sudo git --work-tree=/home/pi/odoo/ --git-dir=/home/pi/odoo/.git pull
(sleep 5 && sudo reboot) &
