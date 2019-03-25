#!/usr/bin/env bash

logger -t posbox_clear_wifi_configuration "Clearing the wifi configuration"
sudo rm -f /home/pi/wifi_network.txt
