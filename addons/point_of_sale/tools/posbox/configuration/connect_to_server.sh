#!/usr/bin/env bash

# Write the server configuration
function connect () {
	SERVER="${1}"
	CURRENT_SERVER_FILE=/home/pi/odoo-remote-server.conf
	HOSTS=/etc/hosts
	HOSTNAME="$(hostname)"
	IOT_NAME="${2}"
	sudo mount -o remount,rw /
	echo "${SERVER}" > ${CURRENT_SERVER_FILE}
	sudo sed -i "s/${HOSTNAME}/${IOT_NAME}/g" ${HOSTS}
	sudo hostname "${IOT_NAME}"
	sudo mount -o remount,ro /
	sudo service odoo restart
}

connect "${1}" "${2}" &