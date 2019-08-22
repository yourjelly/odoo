# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from odoo import api, SUPERUSER_ID
from .models.res_company import UNALTERABLE_COUNTRIES


def _setup_inalterability(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    # enable ping for this module
    env['publisher_warranty.contract'].update_notification(cron_mode=True)

    fr_companies = env['res.company'].search([('partner_id.country_id.code', 'in', UNALTERABLE_COUNTRIES)])
    if fr_companies:
        # create the securisation sequence per company
        fr_companies._create_secure_sequence(['secure_sequence_id'])

        # set the restrict_mode_hash_table field to True
        journals = env['account.journal'].search([('company_id', 'in', fr_companies.ids)])
        journals.write({'restrict_mode_hash_table': True})
