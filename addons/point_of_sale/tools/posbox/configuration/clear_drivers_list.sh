#!/usr/bin/env bash

logger -t posbox_clear_server_configuration "Clearing the drivers list"
sudo rm -rf /home/pi/odoo/addons/hw_drivers/drivers/*
