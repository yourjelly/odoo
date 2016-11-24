# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# flake8: noqa

import logging
import sys
import os

import odoo

from command import Command, OptionGroup, Option, init_settings, main

# from . import config
from . import deploy
from . import managedb
from . import scaffold
from . import server
from . import server_legacy
from . import shell
from . import start
from . import test
from . import translate

# Ensure the settings are properly initialized enven when using Odoo as a lib.
# The settings default values are harvested from the registered commands.
init_settings()
