# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from . import wizard
from . import report

from odoo import api, SUPERUSER_ID

SYSCOHADA_LIST = ['BJ', 'BF', 'CM', 'CF', 'KM', 'CG', 'CI', 'GA', 'GN', 'GW', 'GQ', 'ML', 'NE', 'CD', 'SN', 'TD', 'TG']

def _auto_install_l10n(cr, registry):
    #check the country of the main company (only) and eventually load some module needed in that country
    env = api.Environment(cr, SUPERUSER_ID, {})
    country_code = env.company.country_id.code
    if country_code:
        #auto install localization module(s) if available
        module_list = []
        if country_code in SYSCOHADA_LIST:
            #countries using OHADA Chart of Accounts
            module_list.append('l10n_syscohada')
        elif country_code == 'GB':
            module_list.append('l10n_uk')
        elif country_code == 'DE':
            module_list.append('l10n_de_skr03')
            module_list.append('l10n_de_skr04')
        else:
            if env['ir.module.module'].search([('name', '=', 'l10n_' + country_code.lower())]):
                module_list.append('l10n_' + country_code.lower())
            else:
                module_list.append('l10n_generic_coa')
        module_ids = env['ir.module.module'].search([('name', 'in', module_list), ('state', '=', 'uninstalled')])
        module_ids.sudo().button_install()
