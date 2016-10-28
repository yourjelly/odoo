# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
"""
Odoo settings
"""
from __future__ import absolute_import, division, print_function



from . import deprecation  # noqa
from . import appdirs  # noqa


# Paths to search for OpenERP addons.
addons_paths = []

# List of server-wide modules to load. Those modules are supposed to provide
# features not necessarily tied to a particular database. This is in contrast
# to modules that are always bound to a specific database when they are
# installed (i.e. the majority of OpenERP addons). This is set with the --load
# command-line option.
server_wide_modules = []
