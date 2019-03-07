#!/usr/bin/env bash

# check if actual certificate is vali for next week
function connect () {
	DB_UUID="${1}"
	CERT=/etc/ssl/certs/nginx-selfsigned.crt
	VALID=$(openssl x509 -checkend 604800 -noout -in "${CERT}")
	echo "${VALID}"
	if [ ! "${VALID}" ]
	then
	  echo "Certificate has expired or will do so within 24 hours!"
	  echo "(or is invalid/not found)"
	  echo "Download new one"
	else
	  echo "Certificate is good for another week!"
	fi
}

connect "${1}"