# -*- coding: utf-8 -*-

from . import models
from . import report

from odoo import api, SUPERUSER_ID

#
# `hr_pin` module is required by `pos_hr`. But it can't depend on it
# since `pos_hr` should auto install when only `hr` and `point_of_sale` are installed
# (we don't want to manually install `hr_pin` to have `pos_hr` install itself).
# This post_init_hook is a workaround to install `hr_pin` when `pos_hr` is installed.
#
# Note: `hr_pin` can't depend on `point_of_sale` to autoinstall because it is also
# required by `hr_attendance` which is independant of pos.
def _auto_install_hr_pin(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    module_list = ['hr_pin']
    module_ids = env['ir.module.module'].search([('name', 'in', module_list), ('state', '=', 'uninstalled')])
    module_ids.sudo().button_install()
