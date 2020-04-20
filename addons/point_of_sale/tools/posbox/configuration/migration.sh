#!/usr/bin/env bash

# migration of config file from IoT v20_02 to 20_06

find "${HOME}" -maxdepth 1 -type f ! -name ".*" | while read iotconfig; do
    BASE=$(basename "${iotconfig}")
    if [ "${BASE}" = "odoo-remote-server.conf" ]
    then
        add_iot_config "iot_box_config" "url_odoo_server" "${iotconfig}"
    elif [ "${BASE}" = "odoo-db-uuid.conf" ]
    then
        add_iot_config "iot_box_config" "db_uuid" "${iotconfig}"
    elif [ "${BASE}" = "odoo-enterprise-code.conf" ]
    then
        add_iot_config "iot_box_config" "enterprise_code" "${iotconfig}"
    fi
done


function add_iot_config () {
    IOT_CONFIG_FILE="${HOME}"/iot_config

    PARENT="${1}"
    KEY="${2}"
    VALUE_FILE="${3}"

    VALUE=$(cat $VALUE_FILE)
    NEW_IOT_BOX_CONFIG=$(jq -rc --arg arg $VALUE .$PARENT'+{'$KEY' : $arg}' $IOT_CONFIG_FILE)
    echo $(jq .$PARENT'='$NEW_IOT_BOX_CONFIG $IOT_CONFIG_FILE) > $IOT_CONFIG_FILE
}
