# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2019 Bohdan Lisnenko <bohdan.lisnenko@erp.co.ua>, ERP Ukraine

from odoo import api, SUPERUSER_ID


def load_translations(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env.ref('l10n_ua.l10n_ua_psbo_chart_template').process_coa_translations()
