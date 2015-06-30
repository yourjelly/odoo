# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Modules (also called addons) management.

"""

import odoo
from odoo.tools import pycompat


def load_module_graph(cr, graph, status=None, perform_checks=True, skip_modules=None, report=None):
    return odoo.registry(cr.dbname).load_module_graph(
        cr, graph, perform_checks=perform_checks, skip_modules=skip_modules, report=report)

def _check_module_names(cr, module_names):
    return odoo.registry(cr.dbname)._check_module_names(cr, module_names)

def load_marked_modules(cr, graph, states, force, progressdict, report, loaded_modules, perform_checks):
    return odoo.registry(cr.dbname).load_marked_modules(
        cr, graph, states, force=force, report=report,
        loaded_modules=loaded_modules, perform_checks=perform_checks)

def load_modules(db, force_demo=False, status=None, update_module=False):
    return odoo.registry(db).load_modules(force_demo=force_demo, update_module=update_module)
