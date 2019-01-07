#!/usr/bin/env bash

logger -t posbox_clear_server_configuration "Clearing the server configuration"
sudo rm -f /home/pi/odoo-remote-server.conf
