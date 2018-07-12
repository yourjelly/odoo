#!/usr/bin/env bash

# Write the server configuration
function connect () {
	SERVER="${1}"
	CURRENT_SERVER_FILE=/home/pi/odoo-remote-server.conf
	sudo mount -o remount,rw /
	echo "${SERVER}" > ${CURRENT_SERVER_FILE}
	sudo mount -o remount,ro /
	/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/inform_server.py
}

connect "${1}" &