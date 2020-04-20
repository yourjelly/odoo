#!/usr/bin/env bash

while true ; do
	if [ -z "$(cat <(ifconfig eth0) <(ifconfig wlan0) | grep "inet ";)" ] ; then
		logger -t posbox_keep_wifi_alive "Lost wifi, trying to reconnect to ${ESSID}"

		sudo /home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_wifi.sh "NO_AP"

		sleep 30
	fi

	sleep 2
done
